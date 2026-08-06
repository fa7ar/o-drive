import { useContainer } from "@/core/container";
import { getProvider } from "@/core/registry";
import { StorageManager } from "@/core/storage-manager";
import { folderPath } from "@/core/vfs";
import type { Connection, FileMetadata, TransferJob } from "@/core/types";
import { DEMO_WORKSPACE_ID } from "@/database/memory";

/**
 * Application services. All provider work goes through the adapter registry
 * and all persistence through repositories — no vendor calls in this layer.
 */

export async function listConnections(): Promise<Connection[]> {
  return useContainer().connections.list(DEMO_WORKSPACE_ID);
}

export async function createConnection(
  providerId: string,
  input: Record<string, string>,
): Promise<Connection> {
  const { connections, activity, tokens, secrets } = useContainer();
  const draft = await getProvider(providerId).connect(input);
  const created = await connections.create({ ...draft, workspaceId: DEMO_WORKSPACE_ID });
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
  const provider = await StorageManager.forConnection(connectionId);
  const created = await provider.createFolder(connectionId, path, name);
  await useContainer().files.upsertMany(connectionId, [created]);
  await useContainer().activity.record({ actor: "you", action: "folder.created", target: name });
  return created;
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
  const { transfers, activity } = useContainer();
  const job = await transfers.create({ ...input, status: "queued", progress: 0 });
  await activity.record({ actor: "you", action: `transfer.${input.direction}`, target: input.fileName });
  return job;
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
