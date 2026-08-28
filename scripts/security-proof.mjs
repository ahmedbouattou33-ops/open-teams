import { createHmac } from "node:crypto";
import { createRequire } from "node:module";
const requireFromMessaging = createRequire(new URL("../services/mcp-messaging/package.json", import.meta.url));
const WebSocket = requireFromMessaging("ws");

const AUTH = process.env.AUTH_URL ?? "http://localhost:4001";
const MSG = process.env.MESSAGING_URL ?? "http://localhost:4002";
const ORIGIN = process.env.WEB_ORIGIN ?? "http://localhost:8080";
const WS = MSG.replace(/^http/, "ws");
const results = [];
function b64(value) { return Buffer.from(value).toString("base64url"); }
function noneToken() { return `${b64(JSON.stringify({ alg: "none", typ: "JWT" }))}.${b64(JSON.stringify({ sub: "forged", email: "forged@example.test" }))}.`; }
function hs256Token(secret) { const h = b64(JSON.stringify({ alg: "HS256", typ: "JWT" })); const p = b64(JSON.stringify({ sub: "forged", email: "forged@example.test" })); return `${h}.${p}.${createHmac("sha256", secret).update(`${h}.${p}`).digest("base64url")}`; }
function check(name, ok, evidence = "") { results.push({ name, ok, evidence }); console.log(`${ok ? "PASS" : "FAIL"} ${name}${evidence ? ` — ${evidence}` : ""}`); }
async function rpc(base, method, params, token) { try { const response = await fetch(`${base}/mcp`, { method: "POST", headers: { "content-type": "application/json", origin: ORIGIN, ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify({ jsonrpc: "2.0", id: `${Date.now()}-${Math.random()}`, method, params }) }); const body = await response.json().catch(() => ({})); return { status: response.status, body }; } catch (error) { return { status: 0, body: { error: { message: error instanceof Error ? error.message : String(error) } } }; } }
function resultOf(reply) { return reply.body?.result ?? reply.body?.error ?? reply.body; }
function hasError(reply) { return !!reply.body?.error || !!reply.body?.result?.error || reply.status >= 400; }
async function wsAttempt(url, timeout = 2500) { return await new Promise((resolve) => { let settled = false; const done = (value) => { if (!settled) { settled = true; resolve(value); } }; const socket = new WebSocket(url); const timer = setTimeout(() => { socket.terminate(); done({ rejected: false, reason: "timeout" }); }, timeout); socket.on("open", () => { clearTimeout(timer); socket.close(); done({ rejected: false, reason: "opened" }); }); socket.on("unexpected-response", (_request, response) => { clearTimeout(timer); response.resume(); done({ rejected: true, reason: `HTTP ${response.statusCode}` }); }); socket.on("close", (code) => { clearTimeout(timer); done({ rejected: code === 4401 || code >= 4000, reason: `close ${code}` }); }); socket.on("error", (error) => { clearTimeout(timer); done({ rejected: true, reason: error.message }); }); }); }

const firstEmail = `proof-a-${Date.now()}@openteams.test`;
const secondEmail = `proof-b-${Date.now()}@openteams.test`;
const password = "Str0ngPassw0rd!x";
const first = await rpc(AUTH, "register_user", { email: firstEmail, password, displayName: "Proof A" });
const tokenA = resultOf(first)?.tokens?.accessToken;
const second = await rpc(AUTH, "register_user", { email: secondEmail, password, displayName: "Proof B" });
const tokenB = resultOf(second)?.tokens?.accessToken;
if (!tokenA || !tokenB) {
  console.log("BLOCKED auth runtime proof: auth service is unavailable or registration failed.");
  console.log(JSON.stringify({ results, blocker: resultOf(first) }, null, 2));
  process.exitCode = 2;
} else {
  const none = await rpc(AUTH, "get_user_workspaces", {}, noneToken());
  check("JWT alg:none rejected", hasError(none), `HTTP ${none.status}`);
  const hs = await rpc(AUTH, "get_user_workspaces", {}, hs256Token(process.env.JWT_PUBLIC_KEY ?? "not-the-RSA-key"));
  check("JWT HS256 confusion rejected", hasError(hs), `HTTP ${hs.status}`);
  const valid = await rpc(AUTH, "get_user_workspaces", {}, tokenA);
  check("valid RS256 token accepted", !hasError(valid), `HTTP ${valid.status}`);

  const wsAReply = await rpc(AUTH, "create_workspace", { name: `Proof A ${Date.now()}` }, tokenA);
  const wsA = resultOf(wsAReply)?.id;
  const wsBReply = await rpc(AUTH, "create_workspace", { name: `Proof B ${Date.now()}` }, tokenB);
  const wsB = resultOf(wsBReply)?.id;
  const chBReply = wsB ? await rpc(AUTH, "create_channel", { workspaceId: wsB, name: "private-proof" }, tokenB) : null;
  const chB = chBReply ? resultOf(chBReply)?.id : null;
  if (wsA && wsB && chB) {
    const operations = [
      ["workspace B list channels", AUTH, "list_channels", { workspaceId: wsB }],
      ["workspace B create channel", AUTH, "create_channel", { workspaceId: wsB, name: `forbidden-${Date.now()}` }],
      ["workspace B message history", MSG, "get_channel_history", { channelId: chB }],
      ["workspace B send message", MSG, "send_message", { channelId: chB, content: { type: "plain", body: "must be rejected" } }],
      ["workspace B files", process.env.STORAGE_URL ?? "http://localhost:4004", "list_channel_files", { channelId: chB }],
      ["workspace B agenda", AUTH, "list_agenda_events", { workspaceId: wsB }],
      ["workspace B notes", AUTH, "list_notes", { workspaceId: wsB }],
      ["workspace B tasks", AUTH, "list_work_tasks", { workspaceId: wsB }],
    ];
    for (const [name, base, method, params] of operations) { const reply = await rpc(base, method, params, tokenA); check(`tenant isolation: ${name}`, hasError(reply), `HTTP ${reply.status}`); }
  } else check("tenant fixture creation", false, "could not create two workspaces/channels");

  const noToken = await wsAttempt(`${WS}/ws`); check("WebSocket /ws rejects missing token", noToken.rejected, noToken.reason);
  const malformed = await wsAttempt(`${WS}/ws?token=not-a-jwt`); check("WebSocket /ws rejects malformed token", malformed.rejected, malformed.reason);
  const noCallToken = await wsAttempt(`${WS}/ws/call`); check("WebSocket /ws/call rejects missing token", noCallToken.rejected, noCallToken.reason);
  const expired = process.env.EXPIRED_TOKEN;
  if (expired) { const expiredResult = await wsAttempt(`${WS}/ws?token=${encodeURIComponent(expired)}`); check("WebSocket /ws rejects expired token", expiredResult.rejected, expiredResult.reason); } else console.log("BLOCKED WebSocket expired-token proof: set EXPIRED_TOKEN to a server-signed expired JWT.");
}
const failed = results.filter((x) => !x.ok);
console.log(JSON.stringify({ passed: results.length - failed.length, failed: failed.length, results }, null, 2));
if (failed.length) process.exitCode = 1;
