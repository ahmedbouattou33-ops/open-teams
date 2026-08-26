/**
 * Quick QA E2E: registers a test user, logs in, and exercises core MCP tools
 * across auth (:4001), messaging (:4002), media-rtc (:4003), storage (:4004).
 * Also verifies CORS headers on each service for origin http://localhost:3000.
 *
 * Usage: node scripts/qa-e2e.mjs
 */
const SERVICES = {
  auth: "http://localhost:4001",
  messaging: "http://localhost:4002",
  mediaRtc: "http://localhost:4003",
  storage: "http://localhost:4004",
};
const ORIGIN = "http://localhost:3000";

let pass = 0;
let fail = 0;
const failures = [];

function check(name, ok, detail = "") {
  if (ok) {
    pass++;
    console.log(`  PASS  ${name}`);
  } else {
    fail++;
    failures.push(`${name}${detail ? ` — ${detail}` : ""}`);
    console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

async function rpc(base, name, params, token) {
  let res;
  try {
    res = await fetch(`${base}/mcp`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: ORIGIN,
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ jsonrpc: "2.0", id: Date.now(), method: name, params }),
    });
  } catch (e) {
    return { res: null, corsOk: false, result: { error: { message: `fetch failed: ${e.message}` } } };
  }
  const corsOk = res.headers.get("access-control-allow-origin") === ORIGIN;
  const body = await res.json().catch(() => ({}));
  return { res, corsOk, result: body.result ?? body.error ?? body };
}

async function main() {
  console.log("OpenTeams QA E2E\n");

  /* ---- health ---- */
  for (const [name, base] of Object.entries(SERVICES)) {
    try {
      const h = await fetch(`${base}/health`);
      const j = await h.json();
      check(`health ${name} (${base})`, h.ok && j.status === "ok", `status=${j.status ?? h.status}`);
    } catch (e) {
      check(`health ${name} (${base})`, false, e.message);
    }
  }

  /* ---- CORS on actual POST responses ---- */
  const email = `qa-${Date.now()}@openteams.test`;
  const password = "Str0ngPassw0rd!x";
  const probe = await rpc(SERVICES.auth, "register_user", { email, password, displayName: "QA Bot" });
  check("CORS Access-Control-Allow-Origin on :4001 POST /mcp", probe.corsOk);
  check("auth.register_user", !!probe.result?.tokens?.accessToken, JSON.stringify(probe.result).slice(0, 120));
  const token = probe.result?.tokens?.accessToken;

  /* ---- CORS probes on other services (unauthenticated call is fine for header check) ---- */
  for (const name of ["messaging", "mediaRtc", "storage"]) {
    try {
    const r = await fetch(`${SERVICES[name]}/mcp`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: ORIGIN },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools_list" }),
    });
    check(`CORS Access-Control-Allow-Origin on ${name} POST /mcp`, r.headers.get("access-control-allow-origin") === ORIGIN, `got ${r.headers.get("access-control-allow-origin")}, HTTP ${r.status}`);
    // drain body
    await r.text();
    } catch (e) {
      check(`CORS Access-Control-Allow-Origin on ${name} POST /mcp`, false, e.message);
    }
  }

  if (!token) {
    console.log("\nAborting further steps: no token.");
  } else {
    /* ---- workspaces & channels (auth) ---- */
    const ws = await rpc(SERVICES.auth, "create_workspace", { name: `qa-ws-${Date.now()}`, description: "QA" }, token);
    check("auth.create_workspace", !!ws.result?.id, JSON.stringify(ws.result).slice(0, 120));
    const wsId = ws.result?.id;

    const ch = wsId
      ? await rpc(SERVICES.auth, "create_channel", { workspaceId: wsId, name: "qa-general" }, token)
      : { result: null };
    check("auth.create_channel", !!ch.result?.id, JSON.stringify(ch.result).slice(0, 160));
    const channelId = ch.result?.id ?? "";

    /* ---- keys (E2EE registry) ---- */
    const key = await rpc(SERVICES.auth, "store_user_public_key", { identityPublicKey: "MCowBQYDK2VwAyEA" + "A".repeat(43) }, token);
    check("auth.store_user_public_key", !key.result?.error && !key.result?.code, JSON.stringify(key.result).slice(0, 120));

    /* ---- messaging ---- */
    if (channelId) {
      const msg = await rpc(SERVICES.messaging, "send_message", { channelId, content: { type: "plain", body: "hello from QA" } }, token);
      check("messaging.send_message", !!msg.result?.id || (!msg.result?.error && !msg.result?.code), JSON.stringify(msg.result).slice(0, 160));
    }

    /* ---- media-rtc ---- */
    const calls = await rpc(SERVICES.mediaRtc, "get_active_calls", { workspaceId: wsId ?? "" }, token);
    check("mediaRTC.get_active_calls", !calls.result?.error, JSON.stringify(calls.result).slice(0, 160));

    /* ---- storage ---- */
    const files = await rpc(SERVICES.storage, "list_channel_files", { channelId }, token);
    check("storage.list_channel_files", !files.result?.error, JSON.stringify(files.result).slice(0, 160));
  }

  /* ---- frontend routes ---- */
  for (const path of ["/", "/login", "/register", "/enterprise"]) {
    try {
      const r = await fetch(`http://localhost:3000${path}`);
      check(`web GET ${path} -> ${r.status}`, r.ok, `HTTP ${r.status}`);
      await r.text();
    } catch (e) {
      check(`web GET ${path}`, false, e.message);
    }
  }

  console.log(`\n=== RESULTS: ${pass} passed, ${fail} failed ===`);
  if (failures.length) {
    console.log("Failures:");
    for (const f of failures) console.log(`  - ${f}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
