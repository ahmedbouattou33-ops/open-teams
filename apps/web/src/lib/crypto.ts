const encoder = new TextEncoder();
const decoder = new TextDecoder();

export function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

export function fromBase64(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export async function sha256Hex(data: ArrayBuffer | string): Promise<string> {
  const buffer = typeof data === "string" ? encoder.encode(data) : data;
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function deriveAesKey(passphrase: string, salt: Uint8Array): Promise<CryptoKey> {
  const baseKey = await crypto.subtle.importKey("raw", encoder.encode(passphrase), "PBKDF2", false, [
    "deriveKey",
  ]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: salt as unknown as BufferSource, iterations: 310_000, hash: "SHA-256" },
    baseKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

export interface EncryptedPayload {
  readonly saltB64: string;
  readonly ivB64: string;
  readonly ciphertextB64: string;
}

export async function encryptString(plain: string, passphrase: string): Promise<EncryptedPayload> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveAesKey(passphrase, salt);
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: iv as unknown as BufferSource },
    key,
    encoder.encode(plain),
  );
  return { saltB64: toBase64(salt), ivB64: toBase64(iv), ciphertextB64: toBase64(new Uint8Array(ciphertext)) };
}

export async function decryptString(payload: EncryptedPayload, passphrase: string): Promise<string> {
  const key = await deriveAesKey(passphrase, fromBase64(payload.saltB64));
  const plain = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: fromBase64(payload.ivB64) as unknown as BufferSource },
    key,
    fromBase64(payload.ciphertextB64) as unknown as BufferSource,
  );
  return decoder.decode(plain);
}

export function serializeEncrypted(payload: EncryptedPayload): string {
  return JSON.stringify({ format: "openteams.encrypted.v1", ...payload });
}

export function parseEncrypted(raw: string): EncryptedPayload | null {
  try {
    const parsed = JSON.parse(raw) as Partial<EncryptedPayload> & { format?: string };
    if (parsed.format !== "openteams.encrypted.v1") return null;
    if (!parsed.saltB64 || !parsed.ivB64 || !parsed.ciphertextB64) return null;
    return { saltB64: parsed.saltB64, ivB64: parsed.ivB64, ciphertextB64: parsed.ciphertextB64 };
  } catch {
    return null;
  }
}
