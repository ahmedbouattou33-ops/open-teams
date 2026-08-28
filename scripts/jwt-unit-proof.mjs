import { generateKeyPairSync, createHmac } from "node:crypto";
import { createRequire } from "node:module";
const require = createRequire(new URL("../services/mcp-auth-workspace/package.json", import.meta.url));
const jwt = require("jsonwebtoken");
import { signAccessToken, verifyAccessToken } from "../services/mcp-auth-workspace/dist/auth/jwt.js";

const { publicKey, privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048, publicKeyEncoding: { type: "spki", format: "pem" }, privateKeyEncoding: { type: "pkcs8", format: "pem" } });
const env = { accessPublicKeyPem: publicKey, accessPrivateKeyPem: privateKey, JWT_ISSUER: "openteams-test", JWT_AUDIENCE: "openteams-web", JWT_ACCESS_TTL: "10m" };
const claims = { sub: "user-proof", email: "proof@example.test", displayName: "Proof User" };
const valid = signAccessToken(claims, env);
function enc(value) { return Buffer.from(JSON.stringify(value)).toString("base64url"); }
const none = `${enc({ alg: "none", typ: "JWT" })}.${enc(claims)}.`;
const hsHeader = enc({ alg: "HS256", typ: "JWT" }); const hsBody = enc(claims); const hsSig = createHmac("sha256", publicKey).update(`${hsHeader}.${hsBody}`).digest("base64url"); const hs = `${hsHeader}.${hsBody}.${hsSig}`;
const forgedWrongIssuer = jwt.sign(claims, privateKey, { algorithm: "RS256", issuer: "wrong", audience: env.JWT_AUDIENCE });
const results = [
  ["valid RS256 accepted", verifyAccessToken(valid, env)?.sub === claims.sub],
  ["alg:none rejected", verifyAccessToken(none, env) === null],
  ["HS256 confusion rejected", verifyAccessToken(hs, env) === null],
  ["wrong issuer rejected", verifyAccessToken(forgedWrongIssuer, env) === null],
];
for (const [name, ok] of results) console.log(`${ok ? "PASS" : "FAIL"} ${name}`);
if (results.some(([, ok]) => !ok)) process.exitCode = 1;
