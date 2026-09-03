import { useContainer } from "@/core/container";
import { DEMO_WORKSPACE_ID } from "@/database/memory";
import type { ApiKey, ApiScope } from "@/core/types";

/**
 * API key lifecycle for the public developer platform. Raw secrets exist only
 * in memory for the duration of a create/rotate call — storage keeps a prefix
 * plus a SHA-256 digest, so a database leak cannot be replayed.
 */

export const API_SCOPES: Array<{ scope: ApiScope; description: string }> = [
  { scope: "drive:read", description: "List drives and their metadata" },
  { scope: "drive:write", description: "Create folders and mutate drive contents" },
  { scope: "file:read", description: "Read file metadata, search and download" },
  { scope: "file:write", description: "Upload, move, copy, rename and delete files" },
  { scope: "transfer:write", description: "Start transfers and inspect jobs" },
  { scope: "share:read", description: "Read share links and their status" },
  { scope: "webhook:write", description: "Register and manage webhook endpoints" },
];

const ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789";

function randomString(length: number): string {
  const raw = crypto.getRandomValues(new Uint8Array(length));
  return [...raw].map((byte) => ALPHABET[byte % ALPHABET.length]).join("");
}

export async function hashSecret(secret: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(secret));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

/** Constant-time comparison for digests. */
function digestsMatch(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function listApiKeys(workspaceId = DEMO_WORKSPACE_ID): Promise<ApiKey[]> {
  return useContainer().apiKeys.list(workspaceId);
}

/** Returns the record plus the one-and-only plaintext secret. */
export async function createApiKey(input: {
  name: string;
  scopes: ApiScope[];
  expiresInDays?: number | null;
  workspaceId?: string;
}): Promise<{ key: ApiKey; secret: string }> {
  const prefix = `odv_live_${randomString(6)}`;
  const secret = `${prefix}_${randomString(32)}`;
  const key = await useContainer().apiKeys.create({
    workspaceId: input.workspaceId ?? DEMO_WORKSPACE_ID,
    name: input.name.trim() || "Untitled key",
    prefix,
    hash: await hashSecret(secret),
    scopes: input.scopes.length ? input.scopes : ["drive:read", "file:read"],
    status: "active",
    lastUsedAt: null,
    expiresAt: input.expiresInDays
      ? new Date(Date.now() + input.expiresInDays * 86_400_000).toISOString()
      : null,
    revokedAt: null,
  });
  return { key, secret };
}

export async function revokeApiKey(keyId: string): Promise<ApiKey> {
  return useContainer().apiKeys.update(keyId, {
    status: "revoked",
    revokedAt: new Date().toISOString(),
  });
}

export async function deleteApiKey(keyId: string): Promise<void> {
  return useContainer().apiKeys.remove(keyId);
}

/** Revokes the old secret and issues a new one under the same name/scopes. */
export async function rotateApiKey(keyId: string): Promise<{ key: ApiKey; secret: string }> {
  const existing = await useContainer().apiKeys.get(keyId);
  if (!existing) throw new Error("API key not found");
  await deleteApiKey(keyId);
  return createApiKey({
    name: existing.name,
    scopes: existing.scopes,
    workspaceId: existing.workspaceId,
  });
}

export interface ApiPrincipal {
  keyId: string;
  workspaceId: string;
  scopes: ApiScope[];
}

/** Resolves a bearer secret to a principal, or null when it is not usable. */
export async function authenticateApiKey(secret: string | null): Promise<ApiPrincipal | null> {
  if (!secret || !secret.startsWith("odv_live_")) return null;
  const prefix = secret.split("_").slice(0, 3).join("_");
  const repo = useContainer().apiKeys;
  const record = await repo.findByPrefix(prefix);
  if (!record || record.status !== "active") return null;
  if (record.expiresAt && Date.parse(record.expiresAt) < Date.now()) {
    await repo.update(record.id, { status: "expired" });
    return null;
  }
  if (!digestsMatch(await hashSecret(secret), record.hash)) return null;
  await repo.update(record.id, { lastUsedAt: new Date().toISOString() });
  return { keyId: record.id, workspaceId: record.workspaceId, scopes: record.scopes };
}

export const hasScope = (principal: ApiPrincipal, scope: ApiScope): boolean =>
  principal.scopes.includes(scope);
