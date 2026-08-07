import { useContainer } from "./container";
import { enqueue, registerJobHandler } from "./jobs";
import { log } from "./logs";
import { StorageManager } from "./storage-manager";
import type { BackgroundJob, JobPriority } from "./types";

/**
 * Transfer Engine. Cross-provider copies stream through the adapter contract
 * only: download stream → temporary buffer → upload stream → metadata update.
 * Vendor APIs are never touched from here, and never from the UI.
 */

interface TransferPayload {
  sourceConnectionId: string;
  targetConnectionId: string;
  fileId: string;
  fileName: string;
  targetPath: string;
  sizeBytes: number;
  deleteSource: boolean;
}

const payloadOf = (job: BackgroundJob) => job.payload as unknown as TransferPayload;

let registered = false;

/** Registers queue handlers once; safe to call from any entry point. */
export function initTransferEngine(): void {
  if (registered) return;
  registered = true;

  registerJobHandler("transfer", async (job, ctx) => {
    const payload = payloadOf(job);
    const source = await StorageManager.forConnection(payload.sourceConnectionId);
    const target = await StorageManager.forConnection(payload.targetConnectionId);

    await ctx.note(`Opening stream from ${source.descriptor.name}`);
    const blob = await source.download(payload.sourceConnectionId, payload.fileId);
    if (await ctx.cancelled()) return;
    await ctx.progress(Math.round(blob.size / 2), blob.size || payload.sizeBytes);

    await ctx.note(`Uploading to ${target.descriptor.name}${payload.targetPath}`);
    const uploaded = await target.upload(
      payload.targetConnectionId,
      { name: payload.fileName, size: blob.size, type: blob.type, blob },
      payload.targetPath,
    );
    await ctx.progress(blob.size || payload.sizeBytes, blob.size || payload.sizeBytes);

    await useContainer().files.upsertMany(payload.targetConnectionId, [uploaded]);

    if (payload.deleteSource) {
      await source.delete(payload.sourceConnectionId, payload.fileId);
      await useContainer().files.remove(payload.fileId);
      await ctx.note("Source object removed (move)");
    }

    await log({
      category: "transfer",
      severity: "info",
      message: `${payload.deleteSource ? "Moved" : "Copied"} ${payload.fileName} to ${target.descriptor.name}`,
      providerId: target.descriptor.id,
    });
  });

  registerJobHandler("upload", async (job, ctx) => {
    const payload = job.payload as { connectionId: string; name: string; size: number; path: string };
    const provider = await StorageManager.forConnection(payload.connectionId);
    const created = await provider.upload(
      payload.connectionId,
      { name: payload.name, size: payload.size },
      payload.path,
    );
    await useContainer().files.upsertMany(payload.connectionId, [created]);
    await ctx.progress(payload.size, payload.size);
    await ctx.note(`Uploaded ${payload.name}`);
  });

  registerJobHandler("download", async (job, ctx) => {
    const payload = job.payload as { connectionId: string; fileId: string; name: string };
    const provider = await StorageManager.forConnection(payload.connectionId);
    const blob = await provider.download(payload.connectionId, payload.fileId);
    await ctx.progress(blob.size, blob.size);
    await ctx.note(`Downloaded ${payload.name}`);
  });

  registerJobHandler("delete", async (job, ctx) => {
    const payload = job.payload as { connectionId: string; fileId: string };
    const provider = await StorageManager.forConnection(payload.connectionId);
    await provider.delete(payload.connectionId, payload.fileId);
    await useContainer().files.remove(payload.fileId);
    await ctx.note("Object deleted");
  });

  registerJobHandler("metadata.refresh", async (job, ctx) => {
    const payload = job.payload as { connectionId: string; path?: string };
    const provider = await StorageManager.forConnection(payload.connectionId);
    const listed = await provider.list(payload.connectionId, payload.path ?? "/");
    await useContainer().files.upsertMany(payload.connectionId, listed);
    await ctx.note(`Indexed ${listed.length} entries`);
  });

  registerJobHandler("sync", async (job, ctx) => {
    const payload = job.payload as { connectionId: string };
    const { sync } = await import("./sync-engine");
    const result = await sync(payload.connectionId);
    await ctx.note(`Sync ${result.status}: +${result.added} ~${result.updated}`);
  });

  registerJobHandler("retry", async (_job, ctx) => {
    await ctx.note("Retry marker consumed");
  });
}

async function connectionLabel(connectionId: string): Promise<string> {
  const connection = await useContainer().connections.get(connectionId);
  return connection?.name ?? connectionId;
}

/** Queues a cross-provider copy or move. */
export async function transfer(input: {
  sourceConnectionId: string;
  targetConnectionId: string;
  fileId: string;
  fileName: string;
  targetPath?: string;
  sizeBytes?: number;
  mode?: "copy" | "move";
  priority?: JobPriority;
}): Promise<BackgroundJob> {
  initTransferEngine();
  const targetConnection = await useContainer().connections.get(input.targetConnectionId);
  return enqueue({
    kind: "transfer",
    priority: input.priority ?? "medium",
    label: `${input.fileName} → ${await connectionLabel(input.targetConnectionId)}`,
    ...(targetConnection ? { providerId: targetConnection.providerId } : {}),
    connectionId: input.targetConnectionId,
    ...(input.sizeBytes ? { bytesTotal: input.sizeBytes } : {}),
    payload: {
      sourceConnectionId: input.sourceConnectionId,
      targetConnectionId: input.targetConnectionId,
      fileId: input.fileId,
      fileName: input.fileName,
      targetPath: input.targetPath ?? "/",
      sizeBytes: input.sizeBytes ?? 0,
      deleteSource: input.mode === "move",
    },
  });
}

/** Mirrors every object of a folder from one connection to another. */
export async function mirror(input: {
  sourceConnectionId: string;
  targetConnectionId: string;
  path?: string;
  priority?: JobPriority;
}): Promise<BackgroundJob[]> {
  initTransferEngine();
  const provider = await StorageManager.forConnection(input.sourceConnectionId);
  const entries = await provider.list(input.sourceConnectionId, input.path ?? "/");
  return Promise.all(
    entries
      .filter((entry) => entry.kind === "file")
      .map((entry) =>
        transfer({
          sourceConnectionId: input.sourceConnectionId,
          targetConnectionId: input.targetConnectionId,
          fileId: entry.providerFileId ?? entry.id,
          fileName: entry.name,
          targetPath: input.path ?? "/",
          sizeBytes: entry.sizeBytes,
          ...(input.priority ? { priority: input.priority } : {}),
        }),
      ),
  );
}

export async function queueUpload(input: {
  connectionId: string;
  name: string;
  size: number;
  path?: string;
  priority?: JobPriority;
}): Promise<BackgroundJob> {
  initTransferEngine();
  const connection = await useContainer().connections.get(input.connectionId);
  return enqueue({
    kind: "upload",
    priority: input.priority ?? "medium",
    label: input.name,
    connectionId: input.connectionId,
    ...(connection ? { providerId: connection.providerId } : {}),
    bytesTotal: input.size,
    payload: { connectionId: input.connectionId, name: input.name, size: input.size, path: input.path ?? "/" },
  });
}

export async function queueSync(connectionId: string): Promise<BackgroundJob> {
  initTransferEngine();
  const connection = await useContainer().connections.get(connectionId);
  return enqueue({
    kind: "sync",
    priority: "low",
    label: `Metadata sync — ${connection?.name ?? connectionId}`,
    connectionId,
    ...(connection ? { providerId: connection.providerId } : {}),
    payload: { connectionId },
  });
}
