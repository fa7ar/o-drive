import { useContainer } from "@/core/container";
import { getProvider } from "@/core/registry";
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

export async function browse(connectionIds: string[], path: string): Promise<FileMetadata[]> {
  return useContainer().files.listByPath(connectionIds, path);
}

export async function listAllFiles(connectionIds: string[]): Promise<FileMetadata[]> {
  return useContainer().files.listAll(connectionIds);
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
