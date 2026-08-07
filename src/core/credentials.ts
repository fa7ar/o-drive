import { descriptorById } from "@/adapters";
import { useContainer } from "./container";
import { publish } from "./event-bus";
import { log } from "./logs";
import type { CredentialRecord, CredentialType } from "./types";

/**
 * SecretManager facade: get / set / delete / rotate / validate. Values are
 * sealed with AES-256-GCM before persistence and never returned in list views.
 */

export async function listCredentials(providerId?: string): Promise<CredentialRecord[]> {
  return useContainer().credentials.list(providerId);
}

/** Credential slots a provider expects, derived from its descriptor. */
export function credentialSlots(providerId: string): Array<{
  key: string;
  label: string;
  type: CredentialType;
}> {
  const descriptor = descriptorById(providerId);
  if (!descriptor) return [];
  if (descriptor.authKind === "oauth") {
    return [
      { key: `${providerId.toUpperCase().replace(/-/g, "_")}_CLIENT_ID`, label: "OAuth client ID", type: "oauth" },
      { key: `${providerId.toUpperCase().replace(/-/g, "_")}_CLIENT_SECRET`, label: "OAuth client secret", type: "oauth" },
    ];
  }
  return descriptor.fields
    .filter((field) => field.key !== "name")
    .map((field) => ({
      key: `${providerId.toUpperCase().replace(/-/g, "_")}_${field.key.replace(/([A-Z])/g, "_$1").toUpperCase()}`,
      label: field.label,
      type: (field.secret ? "api-key" : "env") as CredentialType,
    }));
}

export async function saveCredential(input: {
  id?: string;
  providerId: string | null;
  type: CredentialType;
  label: string;
  key: string;
  plaintext: string;
  rotationDays?: number;
}): Promise<CredentialRecord> {
  if (!validateCredential(input.plaintext)) throw new Error("Value looks invalid or too short");
  const record = await useContainer().credentials.save(input);
  await log({
    category: "security",
    severity: "info",
    message: `Credential ${record.key} saved`,
    ...(record.providerId ? { providerId: record.providerId } : {}),
  });
  await useContainer().activity.record({
    actor: "admin",
    action: "credential.saved",
    target: record.key,
  });
  publish({ type: "credential.changed", credentialId: record.id });
  return record;
}

export async function revealCredential(id: string): Promise<string | null> {
  const value = await useContainer().credentials.reveal(id);
  await log({
    category: "security",
    severity: "warning",
    message: `Credential ${id} revealed by an administrator`,
  });
  return value;
}

export async function rotateCredential(id: string, plaintext: string): Promise<CredentialRecord> {
  if (!validateCredential(plaintext)) throw new Error("Value looks invalid or too short");
  const record = await useContainer().credentials.rotate(id, plaintext);
  await log({ category: "security", severity: "info", message: `Credential ${record.key} rotated` });
  publish({ type: "credential.changed", credentialId: id });
  return record;
}

export async function setCredentialStatus(
  id: string,
  status: CredentialRecord["status"],
): Promise<CredentialRecord> {
  const record = await useContainer().credentials.setStatus(id, status);
  await log({
    category: "security",
    severity: status === "disabled" ? "warning" : "info",
    message: `Credential ${record.key} ${status}`,
  });
  publish({ type: "credential.changed", credentialId: id });
  return record;
}

export async function deleteCredential(id: string): Promise<void> {
  await useContainer().credentials.remove(id);
  await log({ category: "security", severity: "warning", message: `Credential ${id} deleted` });
  publish({ type: "credential.changed", credentialId: id });
}

/** Cheap sanity check — never logs or echoes the value. */
export function validateCredential(plaintext: string): boolean {
  return plaintext.trim().length >= 8;
}

/** Days until the rotation SLA expires; negative means overdue. */
export function rotationDueInDays(record: CredentialRecord): number {
  const from = record.lastRotatedAt ?? record.createdAt;
  const age = (Date.now() - new Date(from).getTime()) / 86_400_000;
  return Math.round(record.rotationDays - age);
}
