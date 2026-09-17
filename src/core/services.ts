import { useContainer } from "@/core/container";
import { defaultActionContext, executeAction } from "@/core/actions";
import { getProvider } from "@/core/registry";
import { StorageManager } from "@/core/storage-manager";
import { folderPath } from "@/core/vfs";
import type { Connection, FileMetadata, TransferJob } from "@/core/types";
import { CURRENT_WORKSPACE } from "@/core/workspace";

/**
 * Application services. All provider work goes through the adapter registry
 * and all persistence through repositories — no vendor calls in this layer.
 */

export async function listConnections(): Promise<Connection[]> {
  return useContainer().connections.list(CURRENT_WORKSPACE);
}

export async function createConnection(
  providerId: string,
  input: Record<string, string>,
): Promise<Connection> {
  const { connections, activity, tokens, secrets } = useContainer();
  const draft = await getProvider(providerId).connect(input);
  const created = await connections.create({ ...draft, workspaceId: CURRENT_WORKSPACE });
  const rawToken = input["token"] ?? input["secret"] ?? `oauth-${providerId}-${created.id}`;
  await tokens.save(created.id, await secrets.seal(rawToken));
  await activity.record({
    actor: "you",
    action: "connection.created",
    target: created.name,
  });
  return created;
}

export async function setConnectionStatus(
  connectionId: string,
  status: Connection["status"],
): Promise<Connection> {
  const { connections, activity } = useContainer();
  if (status === "disconnected") await getProvider((await connections.get(connectionId))!.providerId).disconnect(connectionId);
  const updated = await connections.update(connectionId, { status });
  await activity.record({
    actor: "you",
    action: status === "connected" ? "connection.connected" : "connection.disconnected",
    target: updated.name,
  });
  return updated;
}

export async function renameConnection(connectionId: string, name: string): Promise<Connection> {
  const { connections, activity } = useContainer();
  const updated = await connections.update(connectionId, { name });
  await activity.record({ actor: "you", action: "connection.renamed", target: name });
  return updated;
}

export async function deleteConnection(connectionId: string): Promise<void> {
  const { connections, tokens, activity } = useContainer();
  const target = await connections.get(connectionId);
  await connections.remove(connectionId);
  await tokens.remove(connectionId);
  if (target) {
    await activity.record({ actor: "you", action: "connection.deleted", target: target.name });
  }
}

/** Pulls a folder from every connection into the local metadata index. */
export async function indexPath(connectionIds: string[], path: string): Promise<void> {
  const { files } = useContainer();
  await Promise.all(
    connectionIds.map(async (connectionId) => {
      try {
        const provider = await StorageManager.forConnection(connectionId);
        const listed = await provider.list(connectionId, path);
        await files.upsertMany(connectionId, listed);
      } catch {
        /* offline provider: keep whatever the index already holds */
      }
    }),
  );
}

export async function browse(connectionIds: string[], path: string): Promise<FileMetadata[]> {
  await indexPath(connectionIds, path);
  return useContainer().files.listByPath(connectionIds, path);
}

/** Walks the tree breadth-first so search and favourites see the whole index. */
export async function listAllFiles(connectionIds: string[]): Promise<FileMetadata[]> {
  const { files } = useContainer();
  const queue = ["/"];
  const seen = new Set<string>();
  while (queue.length) {
    const path = queue.shift()!;
    if (seen.has(path)) continue;
    seen.add(path);
    await indexPath(connectionIds, path);
    const level = await files.listByPath(connectionIds, path);
    for (const entry of level) {
      if (entry.kind === "folder") queue.push(folderPath(entry));
    }
  }
  return files.listAll(connectionIds);
}

export async function createFolder(connectionId: string, path: string, name: string) {
  const result = await executeAction<FileMetadata>("file.create_folder", { connectionId, path, name }, defaultActionContext({ actor: { id: "you", type: "user", label: "you", permissions: ["drive:write"] }, source: "web" }));
  if (!result.success) throw new Error(result.error?.message ?? "Folder action failed");
  return result.data!;
}

export async function searchEverything(term: string, connectionIds: string[]) {
  const { search, settings } = useContainer();
  const config = await settings.get();
  return search.query({ term, connectionIds, limit: config.searchResultLimit });
}

export async function listProviderStates() {
  return useContainer().providers.list();
}

export async function setProviderEnabled(providerId: string, enabled: boolean) {
  return useContainer().providers.update(providerId, { enabled });
}

export async function runHealthChecks() {
  return StorageManager.healthCheckAll();
}

export async function toggleFavorite(fileId: string, favorite: boolean): Promise<FileMetadata> {
  return useContainer().files.update(fileId, { favorite });
}

export async function trashFile(fileId: string, trashed: boolean): Promise<FileMetadata> {
  return useContainer().files.update(fileId, { trashed });
}

export async function renameFile(fileId: string, name: string): Promise<FileMetadata> {
  return useContainer().files.update(fileId, { name });
}

export async function listTransfers(): Promise<TransferJob[]> {
  return useContainer().transfers.list();
}

export async function queueTransfer(input: {
  connectionId: string;
  fileName: string;
  direction: TransferJob["direction"];
  sizeBytes: number;
}): Promise<TransferJob> {
  const result = await executeAction<TransferJob>(
    "transfer.create",
    input,
    defaultActionContext({ actor: { id: "you", type: "user", label: "you", permissions: ["transfer:write"] }, source: "web" }),
  );
  if (!result.success) throw new Error(result.error?.message ?? "Transfer action failed");
  return result.data!;
}

export async function updateTransfer(
  jobId: string,
  patch: Partial<TransferJob>,
): Promise<TransferJob> {
  return useContainer().transfers.update(jobId, patch);
}

export async function removeTransfer(jobId: string): Promise<void> {
  return useContainer().transfers.remove(jobId);
}

export async function listActivity(limit?: number) {
  return useContainer().activity.list(limit);
}

export async function getSettings() {
  return useContainer().settings.get();
}

export async function updateSettings(patch: Parameters<ReturnType<typeof useContainer>["settings"]["update"]>[0]) {
  return useContainer().settings.update(patch);
}

export async function listFlags() {
  return useContainer().flags.list();
}

export async function toggleFlag(key: string, enabled: boolean) {
  return useContainer().flags.toggle(key, enabled);
}

/* --------------------------- file-level operations ------------------------ */

export async function getFile(fileId: string): Promise<FileMetadata | null> {
  return useContainer().files.get(fileId);
}

/** Moves a file to another virtual folder inside the same connection. */
export async function moveFile(fileId: string, path: string): Promise<FileMetadata> {
  const result = await executeAction<FileMetadata>("file.move", { fileId, path }, defaultActionContext({ actor: { id: "you", type: "user", label: "you", permissions: ["file:write"] }, source: "web" }));
  if (!result.success) throw new Error(result.error?.message ?? "Move action failed");
  return result.data!;
}

/** Copies a file's metadata into a target path (same or another connection). */
export async function copyFile(
  fileId: string,
  input: { path?: string; connectionId?: string; name?: string },
): Promise<FileMetadata> {
  const result = await executeAction<FileMetadata>("file.copy", { fileId, ...input }, defaultActionContext({ actor: { id: "you", type: "user", label: "you", permissions: ["file:write"] }, source: "web" }));
  if (!result.success) throw new Error(result.error?.message ?? "Copy action failed");
  return result.data!;
}

export async function deleteFile(fileId: string): Promise<void> {
  const result = await executeAction("file.delete", { fileId }, defaultActionContext({ actor: { id: "you", type: "user", label: "you", permissions: ["file:write"] }, source: "web" }));
  if (!result.success) throw new Error(result.error?.message ?? "Delete action failed");
}

/** Registers an uploaded object in the index and queues the transfer job. */
export async function registerUpload(input: {
  connectionId: string;
  path: string;
  name: string;
  sizeBytes: number;
  mimeType?: string;
}): Promise<FileMetadata> {
  const result = await executeAction<FileMetadata>("file.upload", input, defaultActionContext({ actor: { id: "you", type: "user", label: "you", permissions: ["file:write"] }, source: "web" }));
  if (!result.success) throw new Error(result.error?.message ?? "Upload action failed");
  return result.data!;
}

/* ------------------------- ODrive file metadata --------------------------- */
/* Tags, favorites and recents live in the ODrive metadata layer only — they  */
/* are never pushed to the underlying provider.                               */

export async function setFileTags(fileId: string, tags: string[]): Promise<FileMetadata> {
  const cleaned = [...new Set(tags.map((tag) => tag.trim().replace(/^#/, "").toLowerCase()))]
    .filter(Boolean)
    .slice(0, 12);
  const updated = await useContainer().files.update(fileId, { tags: cleaned });
  await useContainer().activity.record({
    actor: "you",
    action: "file.tagged",
    target: updated.name,
  });
  return updated;
}

/** Records an open/preview so the Recent view stays truthful. */
export async function touchFile(fileId: string): Promise<void> {
  try {
    await useContainer().files.update(fileId, { lastOpenedAt: new Date().toISOString() });
  } catch {
    /* non-fatal: recents are best-effort metadata */
  }
}

/** Secure content access for preview/download: always via the adapter layer. */
export async function downloadBlob(connectionId: string, fileId: string): Promise<Blob> {
  const provider = await StorageManager.forConnection(connectionId);
  return provider.download(connectionId, fileId);
}
