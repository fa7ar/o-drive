/**
 * AES-GCM envelope encryption for provider credentials.
 *
 * The key is derived (PBKDF2) from an environment-provided passphrase so no
 * raw secret is ever written next to the ciphertext. Works in both the worker
 * runtime and the browser because it only uses WebCrypto.
 */

const PREFIX = "aesgcm.v1";
const encoder = new TextEncoder();
const decoder = new TextDecoder();

const toB64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));
const fromB64 = (value: string) =>
  Uint8Array.from(atob(value), (character) => character.charCodeAt(0));

let cachedKey: CryptoKey | null = null;
let cachedPassphrase = "";

function passphrase(): string {
  const fromEnv =
    (typeof process !== "undefined" ? process.env?.["ODRIVE_ENCRYPTION_KEY"] : undefined) ??
    (typeof import.meta !== "undefined"
      ? (import.meta as ImportMeta).env?.["VITE_ODRIVE_ENCRYPTION_KEY"]
      : undefined);
  return fromEnv || "odrive-development-key";
}

async function deriveKey(): Promise<CryptoKey> {
  const secret = passphrase();
  if (cachedKey && cachedPassphrase === secret) return cachedKey;
  const material = await crypto.subtle.importKey("raw", encoder.encode(secret), "PBKDF2", false, [
    "deriveKey",
  ]);
  cachedKey = await crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: encoder.encode("odrive.credentials"), iterations: 120_000, hash: "SHA-256" },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
  cachedPassphrase = secret;
  return cachedKey;
}

export async function sealValue(plaintext: string): Promise<string> {
  const key = await deriveKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipher = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, encoder.encode(plaintext));
  return `${PREFIX}:${toB64(iv)}:${toB64(new Uint8Array(cipher))}`;
}

export async function openValue(ciphertext: string): Promise<string> {
  const [prefix, iv, payload] = ciphertext.split(":");
  if (prefix !== PREFIX || !iv || !payload) throw new Error("Unrecognised credential envelope");
  const key = await deriveKey();
  const plain = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: fromB64(iv) },
    key,
    fromB64(payload),
  );
  return decoder.decode(plain);
}

/** Redacts a secret for display; never returns more than the last 4 chars. */
export function maskSecret(value: string): string {
  if (value.length <= 4) return "••••";
  return `••••${value.slice(-4)}`;
}

/* ----------------------------- password hashing ---------------------------- */

const PW_PREFIX = "pbkdf2.v1";
const PW_ITERATIONS = 150_000;

async function derivePasswordBits(password: string, salt: Uint8Array): Promise<string> {
  const material = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, [
    "deriveBits",
  ]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: salt as unknown as BufferSource, iterations: PW_ITERATIONS, hash: "SHA-256" },
    material,
    256,
  );
  return toB64(new Uint8Array(bits));
}

/** One-way hash for share passwords. Plaintext never leaves this function. */
export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return `${PW_PREFIX}:${toB64(salt)}:${await derivePasswordBits(password, salt)}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [prefix, salt, digest] = stored.split(":");
  if (prefix !== PW_PREFIX || !salt || !digest) return false;
  const candidate = await derivePasswordBits(password, fromB64(salt));
  if (candidate.length !== digest.length) return false;
  let diff = 0;
  for (let i = 0; i < candidate.length; i += 1) diff |= candidate.charCodeAt(i) ^ digest.charCodeAt(i);
  return diff === 0;
}

/** Opaque, cryptographically random public token (URL safe, no internal ids). */
export function randomToken(bytes = 16): string {
  const raw = crypto.getRandomValues(new Uint8Array(bytes));
  return [...raw].map((byte) => byte.toString(36).padStart(2, "0")).join("").slice(0, 22);
}

/** Salted one-way hash of a client IP for audit logs. */
export async function hashIp(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(`odrive.ip:${value}`));
  return toB64(new Uint8Array(digest)).slice(0, 22);
}
