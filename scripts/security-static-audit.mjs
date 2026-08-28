import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const tracked = execFileSync("git", ["ls-files"], { cwd: root, encoding: "utf8" }).split(/\r?\n/).filter(Boolean);
const trackedSecrets = tracked.filter((file) => /(^|\/)(\.env($|\.)|.*\.(pem|key)|.*(credential|secret))$/i.test(file));
if (trackedSecrets.length) throw new Error(`Tracked secret-like files found: ${trackedSecrets.join(", ")}`);
const jwt = readFileSync(resolve(root, "services/mcp-auth-workspace/src/auth/jwt.ts"), "utf8");
if (!jwt.includes('algorithms: ["RS256"]')) throw new Error("JWT verifier does not explicitly whitelist RS256");
if (!jwt.includes('algorithm: "RS256"')) throw new Error("JWT signer is not explicitly RS256");
for (const file of [".env", "services/mcp-auth-workspace/.env", "apps/web/.env"]) {
  if (existsSync(resolve(root, file)) && tracked.includes(file)) throw new Error(`Tracked environment file found: ${file}`);
}
console.log(JSON.stringify({ ok: true, checks: ["no tracked env/private-key files", "JWT signer RS256", "JWT verifier RS256 allow-list"], runtimeTests: ["alg:none", "HS256 confusion", "refresh-token replay", "tenant isolation", "WebSocket expiry", "upload traversal/TTL", "E2EE ciphertext-only"] }, null, 2));
