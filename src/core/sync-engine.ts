import { useContainer } from "./container";
import { publish } from "./event-bus";
import { log } from "./logs";
import { StorageManager } from "./storage-manager";
import { folderPath } from "./vfs";
import type { ConflictResolution, SyncJob } from "./types";

/**
 * Sync Engine — reconciles the local metadata index with a provider.
 * Flow: scan → diff → reconcile → update index → surface conflicts.
 * Runs are idempotent: a connection can only have one active sync at a time.
 */

const active = new Set<string>();

export async function listSyncJobs(limit = 25): Promise<SyncJob[]> {
  return useContainer().sync.list(limit);
}

export async function listSyncHistory(limit = 25) {
  return useContainer().sync.history(limit);
}

/** Scans one folder level and returns the entries the provider reports. */
async function scan(connectionId: string, path: string) {
  const provider = await StorageManager.forConnection(connectionId);
  return provider.list(connectionId, path);
}

export async function sync(connectionId: string): Promise<SyncJob> {
  const { connections, files, sync: repo } = useContainer();
  const connection = await connections.get(connectionId);
  if (!connection) throw new Error("Connection not found");

  if (active.has(connectionId)) {
    const running = (await repo.list(50)).find(
      (job) => job.connectionId === connectionId && job.status === "running",
    );
    if (running) return running;
  }
  active.add(connectionId);

  const job = await repo.create({
    connectionId,
    providerId: connection.providerId,
    status: "running",
    scanned: 0,
    added: 0,
    updated: 0,
    removed: 0,
    conflicts: [],
  });
  await log({
    category: "sync",
    severity: "info",
    message: `Sync started for ${connection.name}`,
    providerId: connection.providerId,
  });

  try {
    const queue = ["/"];
    const seen = new Set<string>();
    let scanned = 0;
    let added = 0;
    let updated = 0;
    const conflicts: SyncJob["conflicts"] = [];

    while (queue.length) {
      const path = queue.shift()!;
      if (seen.has(path)) continue;
      seen.add(path);

      const remote = await scan(connectionId, path);
      const local = await files.listByPath([connectionId], path);
      const localById = new Map(local.map((entry) => [entry.id, entry]));

      for (const entry of remote) {
        scanned += 1;
        const previous = localById.get(entry.id);
        if (!previous) {
          added += 1;
        } else if (previous.modifiedAt !== entry.modifiedAt) {
          updated += 1;
          if (new Date(previous.modifiedAt) > new Date(entry.modifiedAt)) {
            conflicts.push({
              id: `conf_${entry.id}`,
              path: entry.path,
              name: entry.name,
              localModifiedAt: previous.modifiedAt,
              remoteModifiedAt: entry.modifiedAt,
              resolution: "pending",
            });
          }
        }
        if (entry.kind === "folder") queue.push(folderPath(entry));
      }

      // reconcile: the remote listing wins unless a conflict was recorded.
      const conflicting = new Set(conflicts.map((conflict) => conflict.id.replace("conf_", "")));
      await files.upsertMany(
        connectionId,
        remote.filter((entry) => !conflicting.has(entry.id)),
      );
    }

    const finished = await repo.update(job.id, {
      status: "completed",
      scanned,
      added,
      updated,
      conflicts,
      finishedAt: new Date().toISOString(),
    });
    await repo.recordHistory({
      syncId: job.id,
      connectionId,
      changes: added + updated,
      conflicts: conflicts.length,
    });
    await log({
      category: "sync",
      severity: conflicts.length ? "warning" : "info",
      message: `Sync finished for ${connection.name} — ${added + updated} changes, ${conflicts.length} conflicts`,
      providerId: connection.providerId,
    });
    publish({ type: "sync.updated", syncId: job.id });
    return finished;
  } catch (error) {
    const failed = await repo.update(job.id, {
      status: "failed",
      error: error instanceof Error ? error.message : "Sync failed",
      finishedAt: new Date().toISOString(),
    });
    await log({
      category: "sync",
      severity: "error",
      message: `Sync failed for ${connection.name}`,
      providerId: connection.providerId,
    });
    return failed;
  } finally {
    active.delete(connectionId);
  }
}

export async function pauseSync(syncId: string): Promise<SyncJob> {
  const job = await useContainer().sync.update(syncId, { status: "paused" });
  publish({ type: "sync.updated", syncId });
  return job;
}

export async function resumeSync(syncId: string): Promise<SyncJob> {
  const { sync: repo } = useContainer();
  const job = await repo.get(syncId);
  if (!job) throw new Error("Sync job not found");
  await repo.update(syncId, { status: "queued" });
  return sync(job.connectionId);
}

export async function cancelSync(syncId: string): Promise<SyncJob> {
  const job = await useContainer().sync.update(syncId, {
    status: "cancelled",
    finishedAt: new Date().toISOString(),
  });
  active.delete(job.connectionId);
  publish({ type: "sync.updated", syncId });
  return job;
}

/** Manual conflict override with an audit entry. */
export async function resolveConflict(
  syncId: string,
  conflictId: string,
  resolution: Exclude<ConflictResolution, "pending">,
): Promise<SyncJob> {
  const { sync: repo, activity } = useContainer();
  const job = await repo.get(syncId);
  if (!job) throw new Error("Sync job not found");
  const conflicts = job.conflicts.map((conflict) =>
    conflict.id === conflictId ? { ...conflict, resolution } : conflict,
  );
  const updated = await repo.update(syncId, { conflicts });
  const conflict = conflicts.find((entry) => entry.id === conflictId);
  await activity.record({
    actor: "you",
    action: `sync.conflict.${resolution}`,
    target: conflict?.name ?? conflictId,
  });
  await log({
    category: "sync",
    severity: "info",
    message: `Conflict on ${conflict?.name ?? conflictId} resolved (${resolution})`,
  });
  publish({ type: "sync.updated", syncId });
  return updated;
}

export const diffSummary = (job: SyncJob): string =>
  `+${job.added} ~${job.updated} -${job.removed}`;
