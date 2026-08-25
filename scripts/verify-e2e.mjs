#!/usr/bin/env node
/**
 * OpenTeams — end-to-end verification against REAL running servers.
 *
 *   auth :4001 · messaging :4002 · media-rtc :4003
 *
 * Usage:  node scripts/verify-e2e.mjs
 * Exits non-zero on any failure. Run after any change to the stack.
 */
import { randomUUID, generateKeyPairSync } from "node:crypto";
import { createRequire } from "node:module";

// `ws` is already installed inside mcp-messaging (pnpm strict layout) — reuse it
// without adding a root dependency.
const require = createRequire(new URL("../services/mcp-messaging/package.json", import.meta.url));
const WebSocket = require("ws");

const AUTH = "http://localhost:4001";
const MSG = "http://localhost:4002";
const RTC = "http://localhost:4003";
const TIMEOUT_MS = 3_000;

/* ---------- tiny helpers ---------- */

async function rpc(base, method, params = {}, token = null) {
  const res = await fetch(`${base}/mcp`, {
    method: "POST",
    headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify({ jsonrpc: "2.0", id: Math.floor(Math.random() * 1e9), method, params }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const body = await res.json();
  if (body.error) throw new Error(`${method} → JSON-RPC error ${body.error.code}: ${body.error.message}`);
  return body.result;
}

function waitForEvent(ws, type, ms = TIMEOUT_MS) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      ws.off("message", onMsg);
      reject(new Error(`timeout: no "${type}" event within ${ms}ms`));
    }, ms);
    function onMsg(data) {
      let frame;
      try {
        frame = JSON.parse(data.toString());
      } catch {
        return;
      }
      if (frame?.type === type) {
        clearTimeout(timer);
        ws.off("message", onMsg);
        resolve(frame);
      }
    }
    ws.on("message", onMsg);
  });
}

function openWs(url) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    ws.once("error", reject);
    ws.once("open", () => resolve(ws));
  });
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ---------- runner ---------- */

const suffix = Date.now();
const results = [];
let ctx;

async function step(label, fn) {
  try {
    await fn();
    results.push({ label, ok: true });
    console.log(`  ✅ ${label}`);
  } catch (err) {
    results.push({ label, ok: false, err });
    console.log(`  ❌ ${label} — ${err.message}`);
    throw err;
  }
}

try {
  console.log("OpenTeams E2E verification\n");

  /* ---- 1. identity ---- */
  const email = `e2e-${suffix}@openteams.test`;
  const password = "Str0ngPassw0rd!x";
  await step("1. register_user + authenticate_user + store_user_public_key", async () => {
    await rpc(AUTH, "register_user", { email, password, displayName: "E2E Bot" });
    const auth = await rpc(AUTH, "authenticate_user", { email, password });
    ctx = { token: auth.tokens.accessToken, userId: auth.user.id };
    // Valid X25519 SPKI DER public key (44 bytes → 60-char base64).
    const { publicKey } = generateKeyPairSync("x25519");
    const identityPublicKey = publicKey.export({ type: "spki", format: "der" }).toString("base64");
    await rpc(AUTH, "store_user_public_key", { identityPublicKey }, ctx.token);
  });

  /* ---- 2. workspace & channel ---- */
  await step("2. create_workspace + create_channel", async () => {
    const created = await rpc(AUTH, "create_workspace", { name: `E2E Workspace ${suffix}` }, ctx.token);
    ctx.workspaceId = created.id;
    const ch = await rpc(AUTH, "create_channel", { workspaceId: ctx.workspaceId, name: `e2e-${suffix}` }, ctx.token);
    ctx.channelId = ch.id;
  });

  /* ---- 3. tagged messaging ---- */
  await step("3. send_message(ACTION_ITEM) → history → mark_as_read → add_reaction", async () => {
    const sent = await rpc(
      MSG,
      "send_message",
      {
        channelId: ctx.channelId,
        content: { type: "plain", body: "Ship the storage phase" },
        tag: "ACTION_ITEM",
        assigneeId: ctx.userId,
      },
      ctx.token,
    );
    ctx.message1Id = sent.message.id;
    const history = await rpc(MSG, "get_channel_history", { channelId: ctx.channelId }, ctx.token);
    const found = history.messages.find((m) => m.id === ctx.message1Id);
    if (!found) throw new Error("sent message missing from channel history");
    if (found.tag !== "ACTION_ITEM" || found.assigneeId !== ctx.userId) {
      throw new Error(`tag/assignee not persisted (tag=${found.tag}, assignee=${found.assigneeId})`);
    }
    await rpc(MSG, "mark_as_read", { channelId: ctx.channelId }, ctx.token);
    await rpc(MSG, "add_reaction", { messageId: ctx.message1Id, emoji: "🚀" }, ctx.token);
  });

  /* ---- 4. realtime broadcast ---- */
  await step("4. WebSocket receives message.created within 3s", async () => {
    const ws = await openWs(`ws://localhost:4002/ws?token=${ctx.token}`);
    try {
      await waitForEvent(ws, "ready");
      const sendPromise = rpc(
        MSG,
        "send_message",
        { channelId: ctx.channelId, content: { type: "plain", body: "realtime probe" } },
        ctx.token,
      );
      const event = await Promise.all([waitForEvent(ws, "message.created"), sendPromise]).then(([e]) => e);
      if (event.message?.channelId !== ctx.channelId) throw new Error("broadcast for wrong channel");
    } finally {
      ws.close();
    }
  });

  /* ---- 5. media-rtc: join_call(null socket) → WS → media-state → leave ---- */
  await step("5. initiate_call → join_call → /ws/call 'ready' → media-state → leave_call", async () => {
    const initiated = await rpc(
      RTC,
      "initiate_call",
      { workspaceId: ctx.workspaceId, channelId: ctx.channelId, callType: "AUDIO" },
      ctx.token,
    );
    ctx.callId = initiated.callId;
    if (!initiated.callId || !initiated.wsUrl.includes(ctx.callId)) throw new Error("initiate_call returned bad payload");

    // Reproduces the audited null-socket scenario: pre-register WITHOUT a socket.
    const joined = await rpc(RTC, "join_call", { callId: ctx.callId }, ctx.token);
    if (!joined.participants.some((p) => p.userId === ctx.userId)) throw new Error("join_call did not register caller");

    // Now attach the real WebSocket — this used to crash on existing.socket.close().
    const ws = await openWs(`ws://localhost:4003/ws/call?token=${ctx.token}&callId=${ctx.callId}`);
    try {
      const ready = await waitForEvent(ws, "ready");
      if (ready.callId !== ctx.callId || ready.userId !== ctx.userId) {
        throw new Error(`unexpected ready payload: ${JSON.stringify(ready)}`);
      }
      ws.send(
        JSON.stringify({
          type: "media-state",
          payload: { userId: ctx.userId, audioMuted: true, videoOff: false, screenSharing: false },
        }),
      );
      await sleep(400); // give the server time to process; a crash would kill the connection
      if (ws.readyState !== ws.OPEN) throw new Error("server dropped connection after media-state frame");

      // Leave explicitly while still connected — closing the socket first would
      // trigger auto-leave + room cleanup, making leave_call a no-op.
      await rpc(RTC, "leave_call", { callId: ctx.callId }, ctx.token);
    } finally {
      ws.close();
    }
    await sleep(200);

    const active = await rpc(RTC, "get_active_calls", { workspaceId: ctx.workspaceId }, ctx.token);
    if ((active.calls ?? []).some((c) => c.id === ctx.callId)) {
      throw new Error("call still listed after last participant left (room cleanup failed)");
    }
  });

  console.log("\n──────── summary ────────");
  for (const r of results) console.log(`${r.ok ? "✅" : "❌"} ${r.label}`);
  const failed = results.filter((r) => !r.ok).length;
  console.log(failed === 0 ? "\nALL CHECKS PASSED ✅" : `\n${failed} CHECK(S) FAILED ❌`);
  process.exitCode = failed === 0 ? 0 : 1;
} catch {
  console.log("\n──────── summary ────────");
  for (const r of results) console.log(`${r.ok ? "✅" : "❌"} ${r.label}`);
  console.log("\nE2E VERIFICATION FAILED ❌ (see first ❌ above)");
  process.exitCode = 1;
}
