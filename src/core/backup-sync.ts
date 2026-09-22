import { DESCRIPTORS } from "@/adapters";
import { defaultActionContext, executeAction } from "@/core/actions";
import { useContainer } from "@/core/container";
import { log } from "@/core/logs";
import { CURRENT_WORKSPACE } from "@/core/workspace";
import type { Connection, ProviderState, TransferJob } from "@/core/types";

export type BackupSyncMode = "backup" | "sync";
export type BackupSyncStatus = "active" | "paused" | "error";
export type BackupSyncSchedule = "manual" | "hourly" | "daily" | "weekly";
export type ConflictPolicy = "keep-source" | "keep-destination" | "newest-wins" | "manual-review";
export type DestinationKind = "connection" | "pool";
export type RoutingStrategyId = "round-robin" | "weighted-round-robin" | "priority-failover" | "least-used" | "most-available-space";

export interface StoragePoolMember {
  connectionId: string;
  weight: number;
  priority: number;
}

export interface StoragePool {
  id: string;
  workspaceId: string;
  name: string;
  strategy: RoutingStrategyId;
  members: StoragePoolMember[];
  healthAware: boolean;
  failover: boolean;
  requiredCapability: "upload" | "download" | "transfer";
  routingCursor: number;
  routingNonce: number;
  createdAt: string;
  updatedAt: string;
}

export interface BackupSyncPolicy {
  id: string;
  workspaceId: string;
  name: string;
  sourceConnectionId: string;
  destination: { kind: DestinationKind; id: string };
  mode: BackupSyncMode;
  schedule: BackupSyncSchedule;
  retentionDays: number;
  includePaths: string[];
  excludePaths: string[];
  fileTypes: string[];
  conflictPolicy: ConflictPolicy;
  retryLimit: number;
  failover: boolean;
  status: BackupSyncStatus;
  lastRunAt: string | null;
  nextRunAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface BackupSyncRun {
  id: string;
  policyId: string;
  status: "queued" | "running" | "completed" | "failed";
  mode: BackupSyncMode;
  selectedConnectionId: string | null;
  attemptedConnectionIds: string[];
  transferJobId?: string;
  reason: string;
  startedAt: string;
  finishedAt?: string;
}

export interface RoutingDecision {
  connection: Connection;
  strategy: RoutingStrategyId;
  eligibleConnectionIds: string[];
  skipped: Array<{ connectionId: string; reason: string }>;
  cursor: number;
}

export interface BackupSyncSnapshot {
  policies: BackupSyncPolicy[];
  pools: StoragePool[];
  runs: BackupSyncRun[];
  routingStrategies: Array<{ id: RoutingStrategyId; label: string; description: string }>;
}

export interface BackupSyncDraft {
  name: string;
  sourceConnectionId: string;
  destinationKind: DestinationKind;
  destinationId: string;
  mode: BackupSyncMode;
  schedule: BackupSyncSchedule;
  retentionDays: number;
  conflictPolicy?: ConflictPolicy;
}

export interface StoragePoolDraft {
  name: string;
  strategy: RoutingStrategyId;
  members: StoragePoolMember[];
  healthAware?: boolean;
  failover?: boolean;
}

const now = () => new Date().toISOString();
const id = (prefix: string) => `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;

const policies = new Map<string, BackupSyncPolicy>();
const pools = new Map<string, StoragePool>();
const runs = new Map<string, BackupSyncRun>();

export const ROUTING_STRATEGIES: BackupSyncSnapshot["routingStrategies"] = [
  { id: "round-robin", label: "Round Robin", description: "Rotate evenly through eligible destinations." },
  { id: "weighted-round-robin", label: "Weighted Round Robin", description: "Rotate through weighted slots such as 50/30/20." },
  { id: "priority-failover", label: "Priority / Failover", description: "Use the lowest priority number first, then fail over." },
  { id: "least-used", label: "Least Used", description: "Prefer the connection with the lowest used quota." },
  { id: "most-available-space", label: "Most Available Space", description: "Prefer the destination with the largest free quota." },
];

function nextRun(schedule: BackupSyncSchedule) {
  if (schedule === "manual") return null;
  const date = new Date();
  if (schedule === "hourly") date.setHours(date.getHours() + 1);
  if (schedule === "daily") date.setDate(date.getDate() + 1);
  if (schedule === "weekly") date.setDate(date.getDate() + 7);
  return date.toISOString();
}

export async function listBackupSync(): Promise<BackupSyncSnapshot> {
  return {
    policies: [...policies.values()],
    pools: [...pools.values()],
    runs: [...runs.values()].sort((a, b) => b.startedAt.localeCompare(a.startedAt)),
    routingStrategies: ROUTING_STRATEGIES,
  };
}

export async function createStoragePool(draft: StoragePoolDraft): Promise<StoragePool> {
  if (!draft.name.trim()) throw new Error("Pool name is required.");
  if (!draft.members.length) throw new Error("At least one connection is required.");
  const timestamp = now();
  const pool: StoragePool = {
    id: id("pool"),
    workspaceId: CURRENT_WORKSPACE,
    name: draft.name.trim(),
    strategy: draft.strategy,
    members: draft.members.map((member, index) => ({
      connectionId: member.connectionId,
      weight: Math.max(1, Number(member.weight) || 1),
      priority: Math.max(1, Number(member.priority) || index + 1),
    })),
    healthAware: draft.healthAware ?? true,
    failover: draft.failover ?? true,
    requiredCapability: "upload",
    routingCursor: 0,
    routingNonce: 0,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  pools.set(pool.id, pool);
  await audit("backup.pool.created", pool.name);
  return pool;
}

export async function updateStoragePool(id: string, patch: Partial<StoragePool>): Promise<StoragePool> {
  const current = requirePool(id);
  const updated = { ...current, ...patch, updatedAt: now() };
  pools.set(id, updated);
  await audit("backup.pool.updated", updated.name);
  return updated;
}

export async function createBackupSyncPolicy(draft: BackupSyncDraft): Promise<BackupSyncPolicy> {
  if (!draft.name.trim()) throw new Error("Policy name is required.");
  if (!draft.sourceConnectionId) throw new Error("Source connection is required.");
  if (!draft.destinationId) throw new Error("Destination is required.");
  const timestamp = now();
  const policy: BackupSyncPolicy = {
    id: id("policy"),
    workspaceId: CURRENT_WORKSPACE,
    name: draft.name.trim(),
    sourceConnectionId: draft.sourceConnectionId,
    destination: { kind: draft.destinationKind, id: draft.destinationId },
    mode: draft.mode,
    schedule: draft.schedule,
    retentionDays: Math.max(1, Number(draft.retentionDays) || 30),
    includePaths: ["/"],
    excludePaths: [],
    fileTypes: [],
    conflictPolicy: draft.conflictPolicy ?? "newest-wins",
    retryLimit: 2,
    failover: true,
    status: "active",
    lastRunAt: null,
    nextRunAt: nextRun(draft.schedule),
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  policies.set(policy.id, policy);
  await audit("backup.policy.created", policy.name);
  return policy;
}

export async function setBackupSyncPolicyStatus(policyId: string, status: BackupSyncStatus): Promise<BackupSyncPolicy> {
  const policy = requirePolicy(policyId);
  const updated = { ...policy, status, updatedAt: now(), nextRunAt: status === "active" ? nextRun(policy.schedule) : null };
  policies.set(policyId, updated);
  await audit(`backup.policy.${status}`, updated.name);
  return updated;
}

export async function runBackupSyncPolicy(policyId: string): Promise<BackupSyncRun> {
  const policy = requirePolicy(policyId);
  if (policy.status !== "active") throw new Error("Policy is paused or unavailable.");
  const startedAt = now();
  const run: BackupSyncRun = {
    id: id("run"),
    policyId,
    status: "running",
    mode: policy.mode,
    selectedConnectionId: null,
    attemptedConnectionIds: [],
    reason: "Selecting destination.",
    startedAt,
  };
  runs.set(run.id, run);

  try {
    const decision = await selectDestination(policy.destination, "upload");
    run.selectedConnectionId = decision.connection.id;
    run.attemptedConnectionIds = [decision.connection.id];
    run.reason = `Selected ${decision.connection.name} via ${decision.strategy}.`;

    const action = await executeAction<TransferJob>("transfer.create", {
      connectionId: decision.connection.id,
      fileName: `${policy.name.replace(/\s+/g, "-").toLowerCase()}-${policy.mode}.snapshot`,
      direction: "upload",
      sizeBytes: 1,
    }, defaultActionContext({
      source: "automation",
      idempotencyKey: `backup-sync:${policy.id}:${startedAt.slice(0, 16)}`,
    }));

    if (!action.success) throw new Error(action.error?.message ?? "Transfer action failed.");
    const completed: BackupSyncRun = {
      ...run,
      status: "completed",
      transferJobId: action.job_id,
      reason: `Queued transfer ${action.job_id ?? "without job id"} through ActionService.`,
      finishedAt: now(),
    };
    runs.set(run.id, completed);
    policies.set(policy.id, { ...policy, lastRunAt: completed.finishedAt ?? now(), nextRunAt: nextRun(policy.schedule), updatedAt: now() });
    await audit("backup.policy.run.completed", policy.name);
    return completed;
  } catch (error) {
    const failed: BackupSyncRun = {
      ...run,
      status: "failed",
      reason: error instanceof Error ? error.message : "Backup/sync run failed.",
      finishedAt: now(),
    };
    runs.set(run.id, failed);
    policies.set(policy.id, { ...policy, lastRunAt: failed.finishedAt ?? now(), status: "error", updatedAt: now() });
    await audit("backup.policy.run.failed", `${policy.name}: ${failed.reason}`, "warning");
    return failed;
  }
}

export async function selectDestination(destination: BackupSyncPolicy["destination"], capability: StoragePool["requiredCapability"]): Promise<RoutingDecision> {
  const { connections, providers } = useContainer();
  if (destination.kind === "connection") {
    const connection = await connections.get(destination.id);
    if (!connection) throw new Error("Destination connection not found.");
    const states = await providers.list();
    const issue = destinationIssue(connection, states.find((state) => state.providerId === connection.providerId), capability, true);
    if (issue) throw new Error(issue);
    return { connection, strategy: "priority-failover", eligibleConnectionIds: [connection.id], skipped: [], cursor: 0 };
  }

  const pool = requirePool(destination.id);
  const [allConnections, providerStates] = await Promise.all([
    connections.list(CURRENT_WORKSPACE),
    providers.list(),
  ]);
  const byId = new Map(allConnections.map((connection) => [connection.id, connection]));
  const stateByProvider = new Map(providerStates.map((state) => [state.providerId, state]));
  const skipped: RoutingDecision["skipped"] = [];
  const eligible = pool.members
    .map((member) => ({ member, connection: byId.get(member.connectionId) }))
    .filter((entry): entry is { member: StoragePoolMember; connection: Connection } => {
      if (!entry.connection) {
        skipped.push({ connectionId: entry.member.connectionId, reason: "Connection missing." });
        return false;
      }
      const issue = destinationIssue(entry.connection, stateByProvider.get(entry.connection.providerId), capability, pool.healthAware);
      if (issue) {
        skipped.push({ connectionId: entry.connection.id, reason: issue });
        return false;
      }
      return true;
    });
  if (!eligible.length) throw new Error("No eligible destination connection is available.");

  const selected = chooseConnection(pool, eligible);
  const nextCursor = selected.cursor;
  pools.set(pool.id, { ...pool, routingCursor: nextCursor, routingNonce: pool.routingNonce + 1, updatedAt: now() });
  return {
    connection: selected.connection,
    strategy: pool.strategy,
    eligibleConnectionIds: eligible.map((entry) => entry.connection.id),
    skipped,
    cursor: nextCursor,
  };
}

function chooseConnection(pool: StoragePool, eligible: Array<{ member: StoragePoolMember; connection: Connection }>) {
  if (pool.strategy === "least-used") {
    return { connection: [...eligible].sort((a, b) => a.connection.quotaUsedBytes - b.connection.quotaUsedBytes)[0].connection, cursor: pool.routingCursor };
  }
  if (pool.strategy === "most-available-space") {
    return {
      connection: [...eligible].sort((a, b) =>
        (b.connection.quotaTotalBytes - b.connection.quotaUsedBytes) - (a.connection.quotaTotalBytes - a.connection.quotaUsedBytes),
      )[0].connection,
      cursor: pool.routingCursor,
    };
  }
  if (pool.strategy === "priority-failover") {
    return { connection: [...eligible].sort((a, b) => a.member.priority - b.member.priority)[0].connection, cursor: pool.routingCursor };
  }
  const ring = pool.strategy === "weighted-round-robin"
    ? eligible.flatMap((entry) => Array.from({ length: Math.max(1, entry.member.weight) }, () => entry.connection))
    : eligible.map((entry) => entry.connection);
  const index = pool.routingCursor % ring.length;
  return { connection: ring[index], cursor: (index + 1) % ring.length };
}

function destinationIssue(connection: Connection, state: ProviderState | undefined, capability: StoragePool["requiredCapability"], healthAware: boolean) {
  if (connection.status !== "connected") return `${connection.name} is ${connection.status}.`;
  if (healthAware && state && (state.enabled === false || state.health === "down")) return `${connection.name} provider is unavailable.`;
  const descriptor = DESCRIPTORS.find((item) => item.id === connection.providerId);
  if (!descriptor || descriptor.capability !== "live") return `${connection.name} provider is not live.`;
  const ops = descriptor.verifiedOperations ?? [];
  const supports = ops.some((item) => item.toLowerCase().includes(capability)) || ops.some((item) => item.toLowerCase().includes("file operations"));
  if (!supports) return `${descriptor.name} does not declare ${capability} support.`;
  return null;
}

function requirePolicy(policyId: string) {
  const policy = policies.get(policyId);
  if (!policy) throw new Error("Backup/sync policy not found.");
  return policy;
}

function requirePool(poolId: string) {
  const pool = pools.get(poolId);
  if (!pool) throw new Error("Storage pool not found.");
  return pool;
}

async function audit(action: string, target: string, severity: "info" | "warning" = "info") {
  await log({ category: "sync", severity, message: `${action}: ${target}` }).catch(() => undefined);
}
