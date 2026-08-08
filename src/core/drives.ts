import { useContainer } from "./container";
import { publish } from "./event-bus";
import { log } from "./logs";
import { tryGetProvider } from "./registry";
import { StorageManager } from "./storage-manager";
import { sync } from "./sync-engine";
import type { Drive, DriveView, SyncJob } from "./types";
import { DEMO_WORKSPACE_ID } from "@/database/memory";
import { createConnection } from "./services";

/**
 * Drive service — the user-facing storage entity. A drive is backed by exactly
 * one connection; a provider backs unlimited connections, so multi-account is
 * native and needs no provider-specific branching anywhere in this file.
 */

export async function listDrives(): Promise<DriveView[]> {
  const { drives, connections } = useContainer();
  const [all, accounts] = await Promise.all([
    drives.list(DEMO_WORKSPACE_ID),
    connections.list(DEMO_WORKSPACE_ID),
  ]);
  return all
    .filter((drive) => accounts.some((account) => account.id === drive.connectionId))
    .map((drive) => {
      const connection = accounts.find((account) => account.id === drive.connectionId)!;
      return {
        drive,
        connection,
        descriptor: tryGetProvider(connection.providerId)?.descriptor ?? null,
      };
    });
}

export async function getDrive(driveId: string): Promise<DriveView | null> {
  const views = await listDrives();
  return views.find((view) => view.drive.id === driveId) ?? null;
}

/** Creates a connection for the chosen provider, then the drive on top of it. */
export async function createDrive(input: {
  providerId: string;
  credentials: Record<string, string>;
  name: string;
  description?: string;
  rootReference?: string;
  makeDefault?: boolean;
}): Promise<Drive> {
  const { drives } = useContainer();
  const connection = await createConnection(input.providerId, input.credentials);
  const drive = await drives.create({
    workspaceId: DEMO_WORKSPACE_ID,
    connectionId: connection.id,
    name: input.name.trim() || connection.name,
    description: input.description,
    rootReference: input.rootReference,
    status: "active",
    isDefault: input.makeDefault ?? false,
    lastSyncAt: null,
    lastHealthCheckAt: null,
  });
  await log({
    category: "connection",
    severity: "info",
    message: `Drive "${drive.name}" created on ${input.providerId}`,
    providerId: input.providerId,
  });
  publish({ type: "connection.changed", connectionId: connection.id });
  return drive;
}

export async function updateDrive(driveId: string, patch: Partial<Drive>): Promise<Drive> {
  const updated = await useContainer().drives.update(driveId, patch);
  await log({ category: "system", severity: "info", message: `Drive "${updated.name}" updated` });
  return updated;
}

export async function setDefaultDrive(driveId: string): Promise<Drive[]> {
  return useContainer().drives.setDefault(DEMO_WORKSPACE_ID, driveId);
}

/** Deletes the drive. The backing connection is removed with it. */
export async function deleteDrive(driveId: string): Promise<void> {
  const { drives } = useContainer();
  const drive = await drives.get(driveId);
  if (!drive) return;
  await drives.remove(driveId);
  const { deleteConnection } = await import("./services");
  const siblings = await drives.listByConnection(drive.connectionId);
  if (!siblings.length) await deleteConnection(drive.connectionId);
  await log({
    category: "connection",
    severity: "warning",
    message: `Drive "${drive.name}" deleted`,
  });
}

export async function syncDrive(driveId: string): Promise<SyncJob> {
  const { drives } = useContainer();
  const drive = await drives.get(driveId);
  if (!drive) throw new Error("Drive not found");
  const job = await sync(drive.connectionId);
  await drives.update(driveId, {
    lastSyncAt: new Date().toISOString(),
    status: job.status === "failed" ? "error" : "active",
  });
  return job;
}

export async function healthCheckDrive(driveId: string): Promise<string> {
  const { drives, connections } = useContainer();
  const drive = await drives.get(driveId);
  if (!drive) throw new Error("Drive not found");
  const connection = await connections.get(drive.connectionId);
  const provider = await StorageManager.forConnection(drive.connectionId);
  const result = await provider.healthCheck();
  await drives.update(driveId, {
    lastHealthCheckAt: new Date().toISOString(),
    status: result.status === "down" ? "error" : "active",
  });
  await log({
    category: "provider",
    severity: result.status === "healthy" ? "info" : "warning",
    message: `Health check for drive "${drive.name}": ${result.status}`,
    providerId: connection?.providerId,
  });
  return result.status;
}
