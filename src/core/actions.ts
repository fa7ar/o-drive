import { descriptorById } from "@/adapters";
import { useContainer } from "@/core/container";
import { enqueue, cancel as cancelJob, retry as retryJob } from "@/core/jobs";
import { log } from "@/core/logs";
import { CURRENT_WORKSPACE } from "@/core/workspace";
import type { BackgroundJob, FileMetadata, TransferJob } from "@/core/types";

export type ActionId =
  | "file.upload"
  | "file.download"
  | "file.rename"
  | "file.copy"
  | "file.move"
  | "file.delete"
  | "file.create_folder"
  | "transfer.create"
  | "transfer.cancel"
  | "transfer.retry"
  | "backup.policy.run"
  | "backup.pool.route"
  | "share.create"
  | "share.update"
  | "share.revoke"
  | "automation.run"
  | "connection.connect"
  | "connection.refresh"
  | "connection.disconnect";

export type ActionErrorCode =
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "INVALID_INPUT"
  | "NOT_FOUND"
  | "CONFLICT"
  | "CAPABILITY_UNSUPPORTED"
  | "RATE_LIMITED"
  | "PROVIDER_ERROR"
  | "ACTION_FAILED";

export type ActionMode = "sync" | "async";

export interface ActionActor {
  id: string;
  type: "user" | "api" | "automation" | "module" | "system";
  label: string;
  permissions: string[];
}

export interface ActionContext {
  actor: ActionActor;
  workspaceId: string;
  requestId?: string;
  idempotencyKey?: string | null;
  source?: "web" | "api" | "automation" | "module" | "cli" | "system";
}

export interface ActionResult<T = unknown> {
  success: boolean;
  data?: T;
  job_id?: string;
  error?: { code: ActionErrorCode; message: string };
  timestamp: string;
  action_id: ActionId;
  request_id: string;
}

export interface ActionDefinition {
  id: ActionId;
  description: string;
  permissions: string[];
  capabilities: string[];
  mode: ActionMode;
  availability: "available" | "testing" | "disabled";
}

export class ActionError extends Error {
  constructor(
    public code: ActionErrorCode,
    message: string,
  ) {
    super(message);
  }
}

const idempotency = new Map<string, ActionResult>();
const PROVIDER_CAPABILITIES: Record<string, string[]> = {
  "google-drive": ["list", "search", "createFolder", "upload", "download", "delete", "rename", "move", "copy", "metadata", "quota", "user", "health", "refresh"],
  r2: ["list", "search", "createFolder", "upload", "download", "stream", "delete", "rename", "move", "copy", "metadata", "quota", "user", "health", "refresh"],
  s3: ["list", "search", "createFolder", "upload", "download", "stream", "delete", "rename", "move", "copy", "metadata", "quota", "user", "health", "refresh"],
  onedrive: ["list", "search", "createFolder", "upload", "download", "delete", "rename", "move", "copy", "metadata", "quota", "user", "health", "refresh"],
  telegram: ["list", "search", "upload", "download", "quota", "user", "health", "refresh"],
};

export const ACTION_REGISTRY: ActionDefinition[] = [
  def("file.upload", "Register an uploaded file and queue upload work.", ["file:write"], ["upload"], "async"),
  def("file.download", "Create a short-lived download descriptor.", ["file:read"], ["download"], "sync"),
  def("file.rename", "Rename a file in ODrive metadata and provider when supported.", ["file:write"], ["rename"], "sync"),
  def("file.copy", "Copy a file to another path or connection.", ["file:write"], ["copy"], "sync"),
  def("file.move", "Move a file to another virtual path.", ["file:write"], ["move"], "sync"),
  def("file.delete", "Delete a file from the ODrive index.", ["file:write"], ["delete"], "sync"),
  def("file.create_folder", "Create a folder through the target provider.", ["drive:write"], ["createFolder"], "sync"),
  def("transfer.create", "Create a transfer job.", ["transfer:write"], ["transfer"], "async"),
  def("transfer.cancel", "Cancel a queued or running transfer job.", ["transfer:write"], ["transfer"], "sync"),
  def("transfer.retry", "Retry a failed transfer job.", ["transfer:write"], ["transfer"], "async"),
  def("backup.policy.run", "Run a backup or sync policy through routing and transfers.", ["automation:write", "transfer:write"], ["transfer"], "async"),
  def("backup.pool.route", "Resolve a storage pool destination using smart routing.", ["drive:read"], ["upload"], "sync"),
  def("share.create", "Create a public share link.", ["share:write"], ["share"], "sync"),
  def("share.update", "Update a share link.", ["share:write"], ["share"], "sync"),
  def("share.revoke", "Revoke a share link.", ["share:write"], ["share"], "sync"),
  def("automation.run", "Run an automation.", ["automation:write"], ["automation"], "async"),
  def("connection.connect", "Connect a provider account.", ["drive:write"], ["connection"], "sync"),
  def("connection.refresh", "Refresh provider credentials.", ["drive:write"], ["connection"], "sync"),
  def("connection.disconnect", "Disconnect a provider account.", ["drive:write"], ["connection"], "sync"),
];

function def(
  id: ActionId,
  description: string,
  permissions: string[],
  capabilities: string[],
  mode: ActionMode,
): ActionDefinition {
  return { id, description, permissions, capabilities, mode, availability: "available" };
}

export function listActions() {
  return ACTION_REGISTRY;
}

const definitionFor = (id: ActionId) => {
  const definition = ACTION_REGISTRY.find((action) => action.id === id);
  if (!definition) throw new ActionError("NOT_FOUND", `Unknown action: ${id}`);
  return definition;
};

function assertPermission(ctx: ActionContext, definition: ActionDefinition) {
  const allowed = definition.permissions.every((permission) => ctx.actor.permissions.includes(permission) || ctx.actor.permissions.includes("*"));
  if (!allowed) throw new ActionError("FORBIDDEN", `Missing permission for ${definition.id}`);
}

function requireString(input: Record<string, unknown>, key: string): string {
  const value = input[key];
  if (typeof value !== "string" || !value.trim()) throw new ActionError("INVALID_INPUT", `${key} is required`);
  return value;
}

function optionalString(input: Record<string, unknown>, key: string, fallback?: string): string | undefined {
  const value = input[key];
  if (value === undefined || value === null || value === "") return fallback;
  if (typeof value !== "string") throw new ActionError("INVALID_INPUT", `${key} must be a string`);
  return value;
}

function optionalNumber(input: Record<string, unknown>, key: string, fallback = 0): number {
  const value = input[key];
  if (value === undefined || value === null || value === "") return fallback;
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) throw new ActionError("INVALID_INPUT", `${key} must be a positive number`);
  return number;
}

async function fileById(id: string): Promise<FileMetadata> {
  const file = await useContainer().files.get(id);
  if (!file) throw new ActionError("NOT_FOUND", "File not found");
  return file;
}

async function connectionFor(id: string) {
  const connection = await useContainer().connections.get(id);
  if (!connection) throw new ActionError("NOT_FOUND", "Connection not found");
  return connection;
}

function providerSupports(providerId: string, capability: string) {
  const descriptor = descriptorById(providerId);
  if (!descriptor) throw new ActionError("NOT_FOUND", "Provider not found");
  if (descriptor.capability !== "live") throw new ActionError("CAPABILITY_UNSUPPORTED", `${descriptor.name} is not live for ${capability}`);
  const liveCapabilities = PROVIDER_CAPABILITIES[providerId] ?? [];
  if (liveCapabilities.includes(capability)) return;
  const verified = descriptor.verifiedOperations ?? [];
  const needle = capability.toLowerCase();
  const loose = verified.some((item) => item.toLowerCase().includes(needle));
  const fileOps = verified.some((item) => item.toLowerCase().includes("file operations"));
  const copyMove = verified.some((item) => item.toLowerCase().includes("copy/move"));
  const streaming = verified.some((item) => item.toLowerCase().includes("streaming"));
  const supported =
    loose ||
    (["rename", "move", "copy", "delete", "createFolder", "list"].includes(capability) && fileOps) ||
    (["move", "copy"].includes(capability) && copyMove) ||
    (capability === "download" && streaming);
  if (!supported) {
    throw new ActionError("CAPABILITY_UNSUPPORTED", `${descriptor.name} does not declare support for ${capability}.`);
  }
}

async function capabilityCheck(id: ActionId, input: Record<string, unknown>) {
  if (!id.startsWith("file.")) return;
  const capability = id.replace("file.", "");
  const connectionId =
    typeof input["connectionId"] === "string"
      ? input["connectionId"]
      : typeof input["fileId"] === "string"
        ? (await fileById(input["fileId"])).connectionId
        : undefined;
  if (!connectionId) return;
  const connection = await connectionFor(connectionId);
  providerSupports(connection.providerId, capability === "create_folder" ? "createFolder" : capability);
}

async function audit(ctx: ActionContext, id: ActionId, status: "success" | "failed", target: string, reason?: string) {
  await useContainer().activity.record({
    actor: ctx.actor.label,
    action: `${id}.${status}`,
    target,
  }).catch(() => undefined);
  await log({
    category: id.startsWith("share.") ? "share" : id.startsWith("transfer.") ? "transfer" : "system",
    severity: status === "success" ? "info" : "warning",
    message: `${id} ${status}${reason ? `: ${reason}` : ""}`,
    context: { requestId: ctx.requestId, actor: ctx.actor.type, workspaceId: ctx.workspaceId },
  }).catch(() => undefined);
}

async function run<T>(id: ActionId, input: Record<string, unknown>, ctx: ActionContext): Promise<T | { data?: T; jobId?: string }> {
  const { files } = useContainer();
  if (id === "file.upload") {
    const connectionId = requireString(input, "connectionId");
    const path = optionalString(input, "path", "/") ?? "/";
    const name = requireString(input, "name");
    const created = await files.create({
      connectionId,
      name,
      path,
      kind: "file",
      mimeType: optionalString(input, "mimeType", "application/octet-stream") ?? "application/octet-stream",
      sizeBytes: optionalNumber(input, "sizeBytes"),
      modifiedAt: new Date().toISOString(),
      favorite: false,
      trashed: false,
    });
    const job = await enqueue({
      kind: "upload",
      payload: { connectionId, fileId: created.id, path, name },
      connectionId,
      label: `Upload ${name}`,
      bytesTotal: created.sizeBytes,
    });
    return { data: created as T, jobId: job.id };
  }
  if (id === "file.download") {
    const file = await fileById(requireString(input, "fileId"));
    const expiresAt = new Date(Date.now() + 300_000).toISOString();
    return { id: file.id, name: file.name, url: `/api/v1/files/${file.id}/content?exp=${Date.parse(expiresAt)}`, expiresAt } as T;
  }
  if (id === "file.rename") {
    return files.update(requireString(input, "fileId"), { name: requireString(input, "name") }) as T;
  }
  if (id === "file.move") {
    return files.update(requireString(input, "fileId"), { path: requireString(input, "path") }) as T;
  }
  if (id === "file.copy") {
    const source = await fileById(requireString(input, "fileId"));
    const { id: _ignored, ...rest } = source;
    return files.create({
      ...rest,
      connectionId: optionalString(input, "connectionId", source.connectionId) ?? source.connectionId,
      path: optionalString(input, "path", source.path) ?? source.path,
      name: optionalString(input, "name", source.name) ?? source.name,
      modifiedAt: new Date().toISOString(),
    }) as T;
  }
  if (id === "file.delete") {
    const file = await fileById(requireString(input, "fileId"));
    await files.remove(file.id);
    return { id: file.id, deleted: true } as T;
  }
  if (id === "file.create_folder") {
    const connectionId = requireString(input, "connectionId");
    const path = optionalString(input, "path", "/") ?? "/";
    const name = requireString(input, "name");
    const folder = await files.create({
      connectionId,
      name,
      path,
      kind: "folder",
      mimeType: "application/vnd.odrive.folder",
      sizeBytes: 0,
      modifiedAt: new Date().toISOString(),
      favorite: false,
      trashed: false,
    });
    return folder as T;
  }
  if (id === "transfer.create") {
    const job = await useContainer().transfers.create({
      connectionId: requireString(input, "connectionId"),
      fileName: requireString(input, "fileName"),
      direction: input["direction"] === "download" ? "download" : "upload",
      status: "queued",
      progress: 0,
      sizeBytes: optionalNumber(input, "sizeBytes"),
    });
    return { data: job as T, jobId: job.id };
  }
  if (id === "transfer.cancel") {
    await cancelJob(requireString(input, "jobId"));
    return { id: input["jobId"], cancelled: true } as T;
  }
  if (id === "transfer.retry") {
    const jobId = requireString(input, "jobId");
    await retryJob(jobId);
    return { jobId } as T;
  }
  throw new ActionError("ACTION_FAILED", `${id} is registered but not implemented yet.`);
}

export async function executeAction<T = unknown>(
  id: ActionId,
  input: Record<string, unknown>,
  ctx: ActionContext,
): Promise<ActionResult<T>> {
  const timestamp = new Date().toISOString();
  const requestId = ctx.requestId ?? `act_${crypto.randomUUID()}`;
  const cacheKey = ctx.idempotencyKey ? `${ctx.workspaceId}:${ctx.actor.id}:${id}:${ctx.idempotencyKey}` : null;
  if (cacheKey && idempotency.has(cacheKey)) return idempotency.get(cacheKey)! as ActionResult<T>;

  try {
    const definition = definitionFor(id);
    if (definition.availability === "disabled") throw new ActionError("CAPABILITY_UNSUPPORTED", `${id} is disabled.`);
    assertPermission(ctx, definition);
    await capabilityCheck(id, input);
    const executed = await run<T>(id, input, ctx);
    const wrapped = executed && typeof executed === "object" && ("jobId" in executed || "data" in executed)
      ? executed as { data?: T; jobId?: string }
      : { data: executed as T };
    const result: ActionResult<T> = {
      success: true,
      ...(wrapped.data !== undefined ? { data: wrapped.data } : {}),
      ...(wrapped.jobId ? { job_id: wrapped.jobId } : {}),
      timestamp,
      action_id: id,
      request_id: requestId,
    };
    await audit(ctx, id, "success", String(input["fileId"] ?? input["connectionId"] ?? input["jobId"] ?? id));
    if (cacheKey) idempotency.set(cacheKey, result);
    return result;
  } catch (error) {
    const actionError = error instanceof ActionError ? error : new ActionError("ACTION_FAILED", error instanceof Error ? error.message : "Action failed");
    await audit(ctx, id, "failed", String(input["fileId"] ?? input["connectionId"] ?? input["jobId"] ?? id), actionError.message);
    return {
      success: false,
      error: { code: actionError.code, message: actionError.message },
      timestamp,
      action_id: id,
      request_id: requestId,
    };
  }
}

export const systemActor = (permissions: string[] = ["*"]): ActionActor => ({
  id: "system",
  type: "system",
  label: "system",
  permissions,
});

export function defaultActionContext(overrides: Partial<ActionContext> = {}): ActionContext {
  return {
    workspaceId: CURRENT_WORKSPACE,
    actor: systemActor(),
    source: "system",
    ...overrides,
  };
}
