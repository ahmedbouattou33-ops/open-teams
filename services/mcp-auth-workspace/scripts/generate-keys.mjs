import { generateKeyPairSync } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const keysDir = join(dirname(fileURLToPath(import.meta.url)), "..", "keys");
mkdirSync(keysDir, { recursive: true });

const { publicKey, privateKey } = generateKeyPairSync("rsa", {
  modulusLength: 4096,
  publicKeyEncoding: { type: "spki", format: "pem" },
  privateKeyEncoding: { type: "pkcs8", format: "pem" },
});

const privatePath = join(keysDir, "access-private.pem");
const publicPath = join(keysDir, "access-public.pem");
writeFileSync(privatePath, privateKey, { mode: 0o600 });
writeFileSync(publicPath, publicKey);

console.log(`JWT RS256 keypair written:\n  ${privatePath}\n  ${publicPath}`);
console.log("Keep the private key secret; never commit it.");
