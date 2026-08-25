import {
  createCipheriv,
  createDecipheriv,
  createPrivateKey,
  createPublicKey,
  diffieHellman,
  generateKeyPairSync,
  hkdfSync,
  randomBytes,
  type KeyObject,
} from "node:crypto";

/**
 * E2EE primitives implementing the Signal-style pattern used for DMs:
 * X25519 agreement keys, Ed25519 signing identity, HKDF-SHA256 root/chain
 * ratchet steps and AES-256-GCM message sealing.
 *
 * Private keys never leave the client; only public keys are registered
 * with the `mcp-auth-workspace` key directory.
 */

const HKDF_SALT = new Uint8Array(32); // zero-filled salt; entropy comes from input keys
const INFO_ROOT = "OpenTeamsRatchetRoot";
const INFO_CHAIN = "OpenTeamsRatchetChain";
const INFO_MESSAGE = "OpenTeamsMessageKey";

export interface AgreementKeyPair {
  /** Base64 SPKI DER (44 bytes) — safe to publish in the key registry. */
  readonly publicKey: string;
  /** PKCS#8 PEM — keep secret on device. */
  readonly privateKey: string;
}

export interface SigningKeyPair {
  readonly publicKey: string;
  readonly privateKey: string;
}

export function generateAgreementKeyPair(): AgreementKeyPair {
  const { publicKey, privateKey } = generateKeyPairSync("x25519");
  return { publicKey: exportPublic(publicKey), privateKey: privateKey.export({ type: "pkcs8", format: "pem" }).toString() };
}

export function generateSigningKeyPair(): SigningKeyPair {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  return { publicKey: exportPublic(publicKey), privateKey: privateKey.export({ type: "pkcs8", format: "pem" }).toString() };
}

function exportPublic(key: KeyObject): string {
  return key.export({ type: "spki", format: "der" }).toString("base64");
}

/** Raw X25519 Diffie-Hellman shared secret (32 bytes, base64). */
export function computeSharedSecret(privateKeyPem: string, peerPublicKeyB64: string): string {
  const shared = diffieHellman({
    privateKey: createPrivateKey(privateKeyPem),
    publicKey: createPublicKey({ key: Buffer.from(peerPublicKeyB64, "base64"), format: "der", type: "spki" }),
  });
  return shared.toString("base64");
}

/**
 * One Double-Ratchet step: derives `[newRootKey, sendChainKey]` from the
 * current root key and a DH output via two independent HKDF expansions.
 */
export function ratchetStep(rootKeyB64: string, dhOutputB64: string): readonly [string, string] {
  const ikm = Buffer.concat([Buffer.from(rootKeyB64, "base64"), Buffer.from(dhOutputB64, "base64")]);
  const okm = Buffer.from(hkdfSync("sha256", ikm, HKDF_SALT, INFO_ROOT, 64));
  const nextRoot = okm.subarray(0, 32).toString("base64");
  const chain = okm.subarray(32).toString("base64");
  return [nextRoot, chain];
}

/** Advances a symmetric chain one message forward. */
export function advanceChain(chainKeyB64: string): readonly [string, string] {
  const okm = Buffer.from(hkdfSync("sha256", Buffer.from(chainKeyB64, "base64"), HKDF_SALT, INFO_CHAIN, 64));
  return [okm.subarray(0, 32).toString("base64"), okm.subarray(32).toString("base64")];
}

export interface SealedMessage {
  readonly iv: string;
  readonly ciphertext: string;
  readonly authTag: string;
}

export function sealMessage(messageKeyB64: string, plaintext: Uint8Array, aad?: Uint8Array): SealedMessage {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", Buffer.from(messageKeyB64, "base64"), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  if (aad) cipher.setAAD(aad);
  return { iv: iv.toString("base64"), ciphertext: ciphertext.toString("base64"), authTag: cipher.getAuthTag().toString("base64") };
}

export function openMessage(messageKeyB64: string, sealed: SealedMessage, aad?: Uint8Array): Buffer {
  const decipher = createDecipheriv("aes-256-gcm", Buffer.from(messageKeyB64, "base64"), Buffer.from(sealed.iv, "base64"));
  if (aad) decipher.setAAD(aad);
  decipher.setAuthTag(Buffer.from(sealed.authTag, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(sealed.ciphertext, "base64")), decipher.final()]);
}

/** Derives the per-message AES-256 key from the current chain key. */
export function deriveMessageKey(chainKeyB64: string): string {
  return Buffer.from(hkdfSync("sha256", Buffer.from(chainKeyB64, "base64"), HKDF_SALT, INFO_MESSAGE, 32)).toString("base64");
}
