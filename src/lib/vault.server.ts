/**
 * Server-side credential vault. Sealed with AES-GCM before storage and never
 * returned to the frontend — only server functions can open an envelope.
 */
import { openValue, sealValue } from "@/core/crypto";

type Bundle = Record<string, string>;

const vault = new Map<string, string>();

export async function saveBundle(connectionId: string, bundle: Bundle): Promise<void> {
  vault.set(connectionId, await sealValue(JSON.stringify(bundle)));
}

export async function readBundle(connectionId: string): Promise<Bundle | null> {
  const sealed = vault.get(connectionId);
  if (!sealed) return null;
  try {
    return JSON.parse(await openValue(sealed)) as Bundle;
  } catch {
    return null;
  }
}

export async function patchBundle(connectionId: string, patch: Bundle): Promise<void> {
  const existing = (await readBundle(connectionId)) ?? {};
  await saveBundle(connectionId, { ...existing, ...patch });
}

export function removeBundle(connectionId: string): void {
  vault.delete(connectionId);
}

export function hasBundle(connectionId: string): boolean {
  return vault.has(connectionId);
}

export class NotConfiguredError extends Error {
  constructor(message = "Provider credentials are not configured") {
    super(message);
    this.name = "NotConfiguredError";
  }
}
