import type {
  ActivityRepository,
  AutomationRepository,
  AutomationRunRepository,
  ConfigRepository,
  ConnectionRepository,
  CredentialRepository,
  DriveRepository,
  FeatureFlagRepository,
  FileRepository,
  JobLogRepository,
  JobRepository,
  ProviderRepository,
  SearchRepository,
  SecretManager,
  SettingsRepository,
  ShareAccessLogRepository,
  ShareRepository,
  SyncRepository,
  SystemLogRepository,
  TokenRepository,
  TransferRepository,
  UserRepository,
  WorkspaceRepository,
} from "@/core/repositories";
import type {
  ActivityLog,
  AppSettings,
  Automation,
  AutomationRun,
  AutomationRunAction,
  BackgroundJob,
  ConfigEntry,
  Connection,
  CredentialRecord,
  Drive,
  FeatureFlag,
  FileMetadata,
  JobLogEntry,
  ProviderState,
  SearchResult,
  Share,
  ShareAccessLog,
  SyncHistoryEntry,
  SyncJob,
  SystemLog,
  TransferJob,
  User,
  Workspace,
} from "@/core/types";
import { DESCRIPTORS } from "@/adapters";
import { maskSecret, openValue, sealValue } from "@/core/crypto";
import { normalizePath } from "@/core/vfs";


const WORKSPACE_ID = "ws_demo";

const id = (prefix: string) => `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

/* ------------------------------- seed state ------------------------------ */

const connections: Connection[] = [
  {
    id: "conn_drive_1",
    workspaceId: WORKSPACE_ID,
    providerId: "google-drive",
    name: "Google Drive — Work",
    accountLabel: "ops@odrive.io",
    status: "connected",
    quotaUsedBytes: 8_400_000_000,
    quotaTotalBytes: 15_000_000_000,
    createdAt: "2026-06-14T09:00:00Z",
  },
  {
    id: "conn_drive_2",
    workspaceId: WORKSPACE_ID,
    providerId: "google-drive",
    name: "Google Drive — Personal",
    accountLabel: "maya@gmail.com",
    status: "connected",
    quotaUsedBytes: 3_100_000_000,
    quotaTotalBytes: 15_000_000_000,
    createdAt: "2026-06-28T11:30:00Z",
  },
  {
    id: "conn_r2_1",
    workspaceId: WORKSPACE_ID,
    providerId: "r2",
    name: "R2 — media",
    accountLabel: "odrive-media",
    status: "connected",
    quotaUsedBytes: 42_000_000_000,
    quotaTotalBytes: 200_000_000_000,
    createdAt: "2026-07-02T13:20:00Z",
    config: { bucket: "odrive-media" },
  },
  {
    id: "conn_tg_1",
    workspaceId: WORKSPACE_ID,
    providerId: "telegram",
    name: "Telegram — archive bot",
    accountLabel: "-1001234567890",
    status: "disconnected",
    quotaUsedBytes: 1_200_000_000,
    quotaTotalBytes: 0,
    createdAt: "2026-07-19T20:10:00Z",
  },
];


const drives: Drive[] = [
  {
    id: "drv_company",
    workspaceId: WORKSPACE_ID,
    connectionId: "conn_drive_1",
    name: "Company Assets",
    description: "Shared brand, legal and finance documents.",
    rootReference: "/",
    status: "active",
    isDefault: true,
    createdAt: "2026-06-14T09:05:00Z",
    updatedAt: "2026-08-06T09:15:00Z",
    lastSyncAt: "2026-08-06T09:15:00Z",
    lastHealthCheckAt: "2026-08-06T23:00:00Z",
  },
  {
    id: "drv_personal",
    workspaceId: WORKSPACE_ID,
    connectionId: "conn_drive_2",
    name: "Maya Personal",
    description: "Second Google account on the same provider.",
    rootReference: "/",
    status: "active",
    isDefault: false,
    createdAt: "2026-06-28T11:35:00Z",
    updatedAt: "2026-08-05T18:00:00Z",
    lastSyncAt: "2026-08-05T18:00:00Z",
    lastHealthCheckAt: "2026-08-06T23:00:00Z",
  },
  {
    id: "drv_media",
    workspaceId: WORKSPACE_ID,
    connectionId: "conn_r2_1",
    name: "Media Library",
    description: "Raw video masters on Cloudflare R2.",
    rootReference: "odrive-media",
    status: "active",
    isDefault: false,
    createdAt: "2026-07-02T13:25:00Z",
    updatedAt: "2026-08-06T21:00:00Z",
    lastSyncAt: "2026-08-06T21:00:00Z",
    lastHealthCheckAt: "2026-08-06T23:00:00Z",
    settings: { bucket: "odrive-media", region: "auto" },
  },
  {
    id: "drv_archive",
    workspaceId: WORKSPACE_ID,
    connectionId: "conn_tg_1",
    name: "Cold Archive",
    description: "Long-term archive behind the Telegram bot.",
    status: "error",
    isDefault: false,
    createdAt: "2026-07-19T20:15:00Z",
    updatedAt: "2026-08-05T05:02:00Z",
    lastSyncAt: null,
    lastHealthCheckAt: "2026-08-05T05:02:30Z",
  },
];

/** Local metadata index. Filled by the indexer from adapter list() calls. */
const fileIndex = new Map<string, FileMetadata[]>();

const transfers: TransferJob[] = [
  {
    id: "job_1",
    connectionId: "conn_drive_1",
    fileName: "quarterly-report.pdf",
    direction: "upload",
    status: "completed",
    progress: 100,
    sizeBytes: 2_412_000,
    createdAt: "2026-08-04T09:12:00Z",
  },
  {
    id: "job_3",
    connectionId: "conn_tg_1",
    fileName: "backup-2025.zip",
    direction: "download",
    status: "failed",
    progress: 18,
    sizeBytes: 184_000_000,
    createdAt: "2026-08-05T05:02:00Z",
    error: "Connection disconnected mid-transfer",
    attempts: 1,
  },
];

const activity: ActivityLog[] = [
  {
    id: "log_1",
    actor: "ops@odrive.io",
    action: "connection.created",
    target: "R2 — media",
    createdAt: "2026-08-04T10:11:00Z",
  },
  {
    id: "log_2",
    actor: "ops@odrive.io",
    action: "transfer.failed",
    target: "backup-2025.zip",
    createdAt: "2026-08-05T05:03:00Z",
  },
  {
    id: "log_3",
    actor: "system",
    action: "token.rotated",
    target: "Google Drive — Work",
    createdAt: "2026-08-05T06:00:00Z",
  },
];

let settings: AppSettings = {
  workspaceName: "ODrive Demo Workspace",
  defaultConnectionId: "conn_drive_1",
  concurrentTransfers: 3,
  requireMagicLinkReauth: true,
  telemetry: false,
  apiKeyLabel: "odrive_live_••••7f21",
  maxUploadMb: 512,
  trashRetentionDays: 30,
  uploadRetries: 2,
  indexContents: false,
  searchResultLimit: 25,
  maintenanceMode: false,
};

let flags: FeatureFlag[] = [
  { key: "provider_google_drive", label: "Google Drive", description: "OAuth-backed Google Drive adapter.", enabled: true, group: "providers" },
  { key: "provider_r2", label: "Cloudflare R2", description: "S3-compatible R2 adapter.", enabled: true, group: "providers" },
  { key: "provider_s3", label: "Amazon S3", description: "SigV4 S3 adapter.", enabled: true, group: "providers" },
  { key: "upload_engine", label: "Upload engine", description: "Queued uploads with retry and cancel.", enabled: true, group: "core" },
  { key: "virtual_filesystem", label: "Virtual filesystem", description: "User-facing paths mapped to provider IDs.", enabled: true, group: "core" },
  { key: "metadata_index", label: "Metadata index", description: "Local index for instant browse.", enabled: true, group: "core" },
  { key: "local_search", label: "Local search", description: "Search the index without provider APIs.", enabled: true, group: "core" },
  { key: "cross_provider_move", label: "Cross-provider move", description: "Move files between two connections in one job.", enabled: false, group: "experimental" },
  { key: "delta_sync", label: "Delta sync", description: "Incremental provider change polling.", enabled: false, group: "experimental" },
];

let providerStates: ProviderState[] = DESCRIPTORS.map((descriptor) => ({
  providerId: descriptor.id,
  enabled: true,
  health: "unknown",
  checkedAt: null,
}));

const jobs: BackgroundJob[] = [
  {
    id: "bg_seed_1",
    kind: "transfer",
    label: "campaign-master.mov → R2",
    payload: { from: "conn_drive_1", to: "conn_r2_1" },
    status: "running",
    priority: "high",
    attempts: 1,
    maxAttempts: 3,
    createdAt: "2026-08-06T22:41:00Z",
    providerId: "r2",
    connectionId: "conn_r2_1",
    progress: 64,
    bytesTotal: 1_820_000_000,
    bytesDone: 1_164_800_000,
    speedBytesPerSecond: 24_500_000,
    etaSeconds: 27,
  },
  {
    id: "bg_seed_2",
    kind: "sync",
    label: "Metadata sync — Google Drive",
    payload: { connectionId: "conn_drive_1" },
    status: "queued",
    priority: "medium",
    attempts: 0,
    maxAttempts: 3,
    createdAt: "2026-08-06T23:02:00Z",
    providerId: "google-drive",
    connectionId: "conn_drive_1",
    progress: 0,
  },
  {
    id: "bg_seed_3",
    kind: "upload",
    label: "backup-2025.zip",
    payload: { connectionId: "conn_tg_1" },
    status: "failed",
    priority: "low",
    attempts: 3,
    maxAttempts: 3,
    createdAt: "2026-08-05T05:02:00Z",
    finishedAt: "2026-08-05T05:09:00Z",
    error: "Connection disconnected mid-transfer",
    providerId: "telegram",
    connectionId: "conn_tg_1",
    progress: 18,
    deadLettered: true,
  },
  {
    id: "bg_seed_4",
    kind: "metadata.refresh",
    label: "Index refresh — R2 media",
    payload: { connectionId: "conn_r2_1" },
    status: "done",
    priority: "low",
    attempts: 1,
    maxAttempts: 3,
    createdAt: "2026-08-06T18:10:00Z",
    finishedAt: "2026-08-06T18:11:12Z",
    providerId: "r2",
    connectionId: "conn_r2_1",
    progress: 100,
  },
];

const jobLogs: JobLogEntry[] = [
  {
    id: "jlog_1",
    jobId: "bg_seed_3",
    createdAt: "2026-08-05T05:04:00Z",
    severity: "warning",
    message: "Attempt 1 failed — retrying in 2s (exponential backoff)",
  },
  {
    id: "jlog_2",
    jobId: "bg_seed_3",
    createdAt: "2026-08-05T05:09:00Z",
    severity: "error",
    message: "Attempt 3 failed — moved to dead-letter queue",
  },
  {
    id: "jlog_3",
    jobId: "bg_seed_1",
    createdAt: "2026-08-06T22:41:02Z",
    severity: "info",
    message: "Stream opened: google-drive → r2 (chunked, 8 MiB windows)",
  },
];

const systemLogs: SystemLog[] = [
  {
    id: "slog_1",
    category: "queue",
    severity: "info",
    message: "Worker pool started with 4 workers",
    createdAt: "2026-08-06T22:40:00Z",
  },
  {
    id: "slog_2",
    category: "transfer",
    severity: "info",
    message: "Cross-provider transfer started: campaign-master.mov",
    providerId: "r2",
    context: { from: "google-drive", to: "r2" },
    createdAt: "2026-08-06T22:41:00Z",
  },
  {
    id: "slog_3",
    category: "connection",
    severity: "error",
    message: "Telegram connection unreachable (socket closed)",
    providerId: "telegram",
    createdAt: "2026-08-05T05:02:30Z",
  },
  {
    id: "slog_4",
    category: "security",
    severity: "warning",
    message: "Google OAuth credential is 84 days old — rotation due in 6 days",
    providerId: "google-drive",
    createdAt: "2026-08-06T06:00:00Z",
  },
  {
    id: "slog_5",
    category: "sync",
    severity: "warning",
    message: "Sync finished with 1 unresolved conflict",
    providerId: "google-drive",
    createdAt: "2026-08-06T09:15:00Z",
  },
  {
    id: "slog_6",
    category: "provider",
    severity: "info",
    message: "Health check passed for 4 of 5 providers",
    createdAt: "2026-08-06T23:00:00Z",
  },
];

const credentials: CredentialRecord[] = [
  {
    id: "cred_drive_oauth",
    providerId: "google-drive",
    type: "oauth",
    label: "Google OAuth client secret",
    key: "GOOGLE_CLIENT_SECRET",
    maskedValue: "••••a91f",
    status: "active",
    createdAt: "2026-05-14T09:00:00Z",
    lastRotatedAt: "2026-05-14T09:00:00Z",
    rotationDays: 90,
  },
  {
    id: "cred_r2_key",
    providerId: "r2",
    type: "api-key",
    label: "R2 secret access key",
    key: "R2_SECRET_ACCESS_KEY",
    maskedValue: "••••7c02",
    status: "active",
    createdAt: "2026-07-02T13:20:00Z",
    lastRotatedAt: "2026-07-28T13:20:00Z",
    rotationDays: 30,
  },
  {
    id: "cred_encryption",
    providerId: null,
    type: "secret",
    label: "Credential encryption key",
    key: "ODRIVE_ENCRYPTION_KEY",
    maskedValue: "••••b4d1",
    status: "active",
    createdAt: "2026-04-01T00:00:00Z",
    lastRotatedAt: "2026-04-01T00:00:00Z",
    rotationDays: 180,
  },
];

/** connection between credential id and its sealed value. */
const credentialVault = new Map<string, string>();

const configEntries: ConfigEntry[] = [
  { key: "general.system_name", section: "general", label: "System name", description: "Shown in the admin console and emails.", type: "string", value: "ODrive", defaultValue: "ODrive" },
  { key: "general.timezone", section: "general", label: "Timezone", description: "Timezone used for job schedules and log display.", type: "string", value: "UTC", defaultValue: "UTC" },
  { key: "providers.default_provider", section: "providers", label: "Default provider", description: "Used when a request does not name a connection.", type: "select", value: "google-drive", defaultValue: "google-drive", options: ["google-drive", "onedrive", "telegram", "r2", "s3"] },
  { key: "providers.health_interval_seconds", section: "providers", label: "Health check interval", description: "Seconds between automated provider health checks.", type: "number", value: 300, defaultValue: 300 },
  { key: "security.encrypt_at_rest", section: "security", label: "Encrypt secrets at rest", description: "AES-256-GCM envelope encryption for every credential.", type: "boolean", value: true, defaultValue: true },
  { key: "security.admin_reveal", section: "security", label: "Allow admin reveal", description: "Admins may reveal a decrypted secret once, with an audit entry.", type: "boolean", value: true, defaultValue: true },
  { key: "security.oauth_rotation_days", section: "security", label: "OAuth rotation SLA (days)", description: "Warn when an OAuth credential exceeds this age.", type: "number", value: 90, defaultValue: 90 },
  { key: "storage.retention_days", section: "storage", label: "Trash retention (days)", description: "How long deleted objects stay recoverable.", type: "number", value: 30, defaultValue: 30 },
  { key: "storage.quota_warning_percent", section: "storage", label: "Quota warning threshold (%)", description: "Raise a warning when a connection passes this usage.", type: "number", value: 85, defaultValue: 85 },
  { key: "transfers.max_retries", section: "transfers", label: "Max retries", description: "Attempts before a job is dead-lettered.", type: "number", value: 3, defaultValue: 3 },
  { key: "transfers.backoff_seconds", section: "transfers", label: "Backoff base (seconds)", description: "Exponential backoff base between retries.", type: "number", value: 2, defaultValue: 2 },
  { key: "transfers.default_priority", section: "transfers", label: "Default priority", description: "Priority assigned to new transfer jobs.", type: "select", value: "medium", defaultValue: "medium", options: ["high", "medium", "low"] },
  { key: "queue.adapter", section: "queue", label: "Queue adapter", description: "Vendor-agnostic queue backend.", type: "select", value: "memory", defaultValue: "memory", options: ["memory", "cloudflare-queue", "redis", "bullmq"] },
  { key: "queue.workers", section: "queue", label: "Worker count", description: "Concurrent workers consuming the queue.", type: "number", value: 4, defaultValue: 4 },
  { key: "queue.dead_letter", section: "queue", label: "Dead-letter queue", description: "Park permanently failing jobs instead of dropping them.", type: "boolean", value: true, defaultValue: true },
  { key: "search.index_interval_minutes", section: "search", label: "Index interval (minutes)", description: "How often the metadata index is refreshed.", type: "number", value: 15, defaultValue: 15 },
  { key: "search.index_contents", section: "search", label: "Index file contents", description: "Extract text from documents for full-text search.", type: "boolean", value: false, defaultValue: false },
  { key: "logging.retention_days", section: "logging", label: "Log retention (days)", description: "System logs older than this are purged.", type: "number", value: 30, defaultValue: 30 },
  { key: "logging.min_severity", section: "logging", label: "Minimum severity", description: "Lowest severity persisted to the log store.", type: "select", value: "info", defaultValue: "info", options: ["debug", "info", "warning", "error", "critical"] },
];

const syncJobs: SyncJob[] = [
  {
    id: "sync_seed_1",
    connectionId: "conn_drive_1",
    providerId: "google-drive",
    status: "completed",
    scanned: 1_284,
    added: 12,
    updated: 31,
    removed: 4,
    conflicts: [
      {
        id: "conf_1",
        path: "/projects/2026",
        name: "roadmap.xlsx",
        localModifiedAt: "2026-08-06T08:41:00Z",
        remoteModifiedAt: "2026-08-06T09:02:00Z",
        resolution: "pending",
      },
    ],
    startedAt: "2026-08-06T09:10:00Z",
    finishedAt: "2026-08-06T09:15:00Z",
  },
  {
    id: "sync_seed_2",
    connectionId: "conn_r2_1",
    providerId: "r2",
    status: "paused",
    scanned: 8_902,
    added: 140,
    updated: 0,
    removed: 0,
    conflicts: [],
    startedAt: "2026-08-06T21:00:00Z",
  },
];

const syncHistory: SyncHistoryEntry[] = [
  {
    id: "shist_1",
    syncId: "sync_seed_1",
    connectionId: "conn_drive_1",
    changes: 47,
    conflicts: 1,
    createdAt: "2026-08-06T09:15:00Z",
  },
];


let workspace: Workspace = { id: WORKSPACE_ID, name: settings.workspaceName, plan: "pro" };
const users: User[] = [];

/* ----------------------------- implementations ---------------------------- */

export const memoryConnectionRepository: ConnectionRepository = {
  async list(workspaceId) {
    return clone(connections.filter((c) => c.workspaceId === workspaceId));
  },
  async get(idValue) {
    return clone(connections.find((c) => c.id === idValue) ?? null);
  },
  async create(input) {
    const created: Connection = { ...input, id: id("conn"), createdAt: new Date().toISOString() };
    connections.unshift(created);
    return clone(created);
  },
  async update(idValue, patch) {
    const target = connections.find((c) => c.id === idValue);
    if (!target) throw new Error("Connection not found");
    Object.assign(target, patch);
    return clone(target);
  },
  async remove(idValue) {
    const index = connections.findIndex((c) => c.id === idValue);
    if (index >= 0) connections.splice(index, 1);
    fileIndex.delete(idValue);
  },
};

export const memoryDriveRepository: DriveRepository = {
  async list(workspaceId) {
    return clone(drives.filter((d) => d.workspaceId === workspaceId));
  },
  async listByConnection(connectionId) {
    return clone(drives.filter((d) => d.connectionId === connectionId));
  },
  async get(idValue) {
    return clone(drives.find((d) => d.id === idValue) ?? null);
  },
  async create(input) {
    const now = new Date().toISOString();
    const created: Drive = { ...input, id: id("drv"), createdAt: now, updatedAt: now };
    if (created.isDefault) {
      for (const drive of drives) if (drive.workspaceId === created.workspaceId) drive.isDefault = false;
    }
    drives.unshift(created);
    return clone(created);
  },
  async update(idValue, patch) {
    const target = drives.find((d) => d.id === idValue);
    if (!target) throw new Error("Drive not found");
    Object.assign(target, patch, { updatedAt: new Date().toISOString() });
    return clone(target);
  },
  async setDefault(workspaceId, idValue) {
    for (const drive of drives) {
      if (drive.workspaceId !== workspaceId) continue;
      drive.isDefault = drive.id === idValue;
    }
    return clone(drives.filter((d) => d.workspaceId === workspaceId));
  },
  async remove(idValue) {
    const index = drives.findIndex((d) => d.id === idValue);
    if (index >= 0) drives.splice(index, 1);
  },
};

export const memoryProviderRepository: ProviderRepository = {
  async list() {
    return clone(providerStates);
  },
  async get(providerId) {
    const found = providerStates.find((state) => state.providerId === providerId);
    if (found) return clone(found);
    const created: ProviderState = { providerId, enabled: true, health: "unknown", checkedAt: null };
    providerStates.push(created);
    return clone(created);
  },
  async update(providerId, patch) {
    providerStates = providerStates.map((state) =>
      state.providerId === providerId ? { ...state, ...patch } : state,
    );
    return memoryProviderRepository.get(providerId);
  },
};

const indexed = (connectionIds: string[]): FileMetadata[] =>
  connectionIds.flatMap((connectionId) => fileIndex.get(connectionId) ?? []);

export const memoryFileRepository: FileRepository = {
  async listByPath(connectionIds, path) {
    const target = normalizePath(path);
    return clone(indexed(connectionIds).filter((f) => f.path === target && !f.trashed));
  },
  async listAll(connectionIds) {
    return clone(indexed(connectionIds));
  },
  async get(idValue) {
    return clone(indexed([...fileIndex.keys()]).find((f) => f.id === idValue) ?? null);
  },
  async upsertMany(connectionId, files) {
    const existing = fileIndex.get(connectionId) ?? [];
    const byId = new Map(existing.map((f) => [f.id, f]));
    for (const file of files) {
      const previous = byId.get(file.id);
      byId.set(file.id, previous ? { ...previous, ...file } : file);
    }
    fileIndex.set(connectionId, [...byId.values()]);
  },
  async create(input) {
    const created: FileMetadata = { ...input, id: id("file") };
    const list = fileIndex.get(created.connectionId) ?? [];
    list.push(created);
    fileIndex.set(created.connectionId, list);
    return clone(created);
  },
  async update(idValue, patch) {
    for (const list of fileIndex.values()) {
      const target = list.find((f) => f.id === idValue);
      if (target) {
        Object.assign(target, patch);
        return clone(target);
      }
    }
    throw new Error("File not found");
  },
  async remove(idValue) {
    for (const [key, list] of fileIndex) {
      const index = list.findIndex((f) => f.id === idValue);
      if (index >= 0) {
        list.splice(index, 1);
        fileIndex.set(key, list);
        return;
      }
    }
  },
  async removeByConnection(connectionId) {
    fileIndex.delete(connectionId);
  },
};

export const memorySearchRepository: SearchRepository = {
  async query({ term, connectionIds, limit = 25 }) {
    const needle = term.trim().toLowerCase();
    if (!needle) return [];
    const results: SearchResult[] = [];

    for (const file of indexed(connectionIds)) {
      if (file.trashed || !file.name.toLowerCase().includes(needle)) continue;
      results.push({
        type: file.kind === "folder" ? "folder" : "file",
        id: file.id,
        title: file.name,
        subtitle: file.path,
        path: file.path,
        connectionId: file.connectionId,
      });
    }

    for (const connection of connections) {
      if (!`${connection.name} ${connection.accountLabel}`.toLowerCase().includes(needle)) continue;
      results.push({
        type: "connection",
        id: connection.id,
        title: connection.name,
        subtitle: connection.accountLabel,
        connectionId: connection.id,
      });
    }

    for (const log of activity) {
      if (!`${log.action} ${log.target}`.toLowerCase().includes(needle)) continue;
      results.push({ type: "activity", id: log.id, title: log.target, subtitle: log.action });
    }

    return clone(results.slice(0, limit));
  },
};

export const memoryTransferRepository: TransferRepository = {
  async list() {
    return clone(transfers);
  },
  async get(idValue) {
    return clone(transfers.find((t) => t.id === idValue) ?? null);
  },
  async create(input) {
    const created: TransferJob = { ...input, id: id("job"), createdAt: new Date().toISOString() };
    transfers.unshift(created);
    return clone(created);
  },
  async update(idValue, patch) {
    const target = transfers.find((t) => t.id === idValue);
    if (!target) throw new Error("Transfer not found");
    Object.assign(target, patch);
    return clone(target);
  },
  async remove(idValue) {
    const index = transfers.findIndex((t) => t.id === idValue);
    if (index >= 0) transfers.splice(index, 1);
  },
};

export const memoryJobRepository: JobRepository = {
  async list(limit = 25) {
    return clone(jobs.slice(0, limit));
  },
  async get(idValue) {
    return clone(jobs.find((j) => j.id === idValue) ?? null);
  },
  async enqueue(input) {
    const created: BackgroundJob = {
      priority: "medium",
      maxAttempts: 3,
      progress: 0,
      ...input,
      id: id("bg"),
      status: input.status ?? "queued",
      attempts: input.attempts ?? 0,
      createdAt: new Date().toISOString(),
    };
    jobs.unshift(created);
    return clone(created);
  },
  async update(idValue, patch) {
    const target = jobs.find((j) => j.id === idValue);
    if (!target) throw new Error("Job not found");
    Object.assign(target, patch);
    return clone(target);
  },
};

export const memoryJobLogRepository: JobLogRepository = {
  async list(jobId) {
    return clone(jobLogs.filter((entry) => entry.jobId === jobId));
  },
  async append(input) {
    const created: JobLogEntry = { ...input, id: id("jlog"), createdAt: new Date().toISOString() };
    jobLogs.push(created);
    return clone(created);
  },
};

export const memorySystemLogRepository: SystemLogRepository = {
  async list(filter = {}) {
    const { category = "all", severity = "all", providerId = "all", term = "", limit = 200 } = filter;
    const needle = term.trim().toLowerCase();
    return clone(
      systemLogs
        .filter((log) => category === "all" || log.category === category)
        .filter((log) => severity === "all" || log.severity === severity)
        .filter((log) => providerId === "all" || log.providerId === providerId)
        .filter((log) => !needle || log.message.toLowerCase().includes(needle))
        .slice(0, limit),
    );
  },
  async append(input) {
    const created: SystemLog = { ...input, id: id("slog"), createdAt: new Date().toISOString() };
    systemLogs.unshift(created);
    if (systemLogs.length > 2000) systemLogs.length = 2000;
    return clone(created);
  },
  async purgeOlderThan(days) {
    const cutoff = Date.now() - days * 86_400_000;
    const before = systemLogs.length;
    const kept = systemLogs.filter((log) => new Date(log.createdAt).getTime() >= cutoff);
    systemLogs.length = 0;
    systemLogs.push(...kept);
    return before - kept.length;
  },
};

export const memoryCredentialRepository: CredentialRepository = {
  async list(providerId) {
    return clone(
      credentials.filter((record) => !providerId || record.providerId === providerId),
    );
  },
  async get(idValue) {
    return clone(credentials.find((record) => record.id === idValue) ?? null);
  },
  async save(input) {
    const sealed = await sealValue(input.plaintext);
    const existing = input.id
      ? credentials.find((record) => record.id === input.id)
      : credentials.find(
          (record) => record.providerId === input.providerId && record.key === input.key,
        );
    if (existing) {
      Object.assign(existing, {
        label: input.label,
        type: input.type,
        maskedValue: maskSecret(input.plaintext),
        lastRotatedAt: new Date().toISOString(),
        ...(input.rotationDays === undefined ? {} : { rotationDays: input.rotationDays }),
      });
      credentialVault.set(existing.id, sealed);
      return clone(existing);
    }
    const created: CredentialRecord = {
      id: id("cred"),
      providerId: input.providerId,
      type: input.type,
      label: input.label,
      key: input.key,
      maskedValue: maskSecret(input.plaintext),
      status: "active",
      createdAt: new Date().toISOString(),
      lastRotatedAt: new Date().toISOString(),
      rotationDays: input.rotationDays ?? (input.type === "oauth" ? 90 : 30),
    };
    credentials.unshift(created);
    credentialVault.set(created.id, sealed);
    return clone(created);
  },
  async reveal(idValue) {
    const sealed = credentialVault.get(idValue);
    if (!sealed) return null;
    try {
      return await openValue(sealed);
    } catch {
      return null;
    }
  },
  async rotate(idValue, plaintext) {
    const target = credentials.find((record) => record.id === idValue);
    if (!target) throw new Error("Credential not found");
    credentialVault.set(idValue, await sealValue(plaintext));
    target.maskedValue = maskSecret(plaintext);
    target.lastRotatedAt = new Date().toISOString();
    return clone(target);
  },
  async setStatus(idValue, status) {
    const target = credentials.find((record) => record.id === idValue);
    if (!target) throw new Error("Credential not found");
    target.status = status;
    return clone(target);
  },
  async remove(idValue) {
    const index = credentials.findIndex((record) => record.id === idValue);
    if (index >= 0) credentials.splice(index, 1);
    credentialVault.delete(idValue);
  },
};

export const memoryConfigRepository: ConfigRepository = {
  async list() {
    return clone(configEntries);
  },
  async set(key, value) {
    const target = configEntries.find((entry) => entry.key === key);
    if (!target) throw new Error("Unknown configuration key");
    target.value = value;
    return clone(target);
  },
  async reset(key) {
    const target = configEntries.find((entry) => entry.key === key);
    if (!target) throw new Error("Unknown configuration key");
    target.value = target.defaultValue;
    return clone(target);
  },
};

export const memorySyncRepository: SyncRepository = {
  async list(limit = 25) {
    return clone(syncJobs.slice(0, limit));
  },
  async get(idValue) {
    return clone(syncJobs.find((job) => job.id === idValue) ?? null);
  },
  async create(input) {
    const created: SyncJob = { ...input, id: id("sync"), startedAt: new Date().toISOString() };
    syncJobs.unshift(created);
    return clone(created);
  },
  async update(idValue, patch) {
    const target = syncJobs.find((job) => job.id === idValue);
    if (!target) throw new Error("Sync job not found");
    Object.assign(target, patch);
    return clone(target);
  },
  async history(limit = 25) {
    return clone(syncHistory.slice(0, limit));
  },
  async recordHistory(input) {
    const created: SyncHistoryEntry = {
      ...input,
      id: id("shist"),
      createdAt: new Date().toISOString(),
    };
    syncHistory.unshift(created);
    return clone(created);
  },
};


export const memoryActivityRepository: ActivityRepository = {
  async list(limit = 20) {
    return clone(activity.slice(0, limit));
  },
  async record(input) {
    const created: ActivityLog = { ...input, id: id("log"), createdAt: new Date().toISOString() };
    activity.unshift(created);
    return clone(created);
  },
};

export const memorySettingsRepository: SettingsRepository = {
  async get() {
    return clone(settings);
  },
  async update(patch) {
    settings = { ...settings, ...patch };
    if (patch.workspaceName) workspace = { ...workspace, name: patch.workspaceName };
    return clone(settings);
  },
};

export const memoryFeatureFlagRepository: FeatureFlagRepository = {
  async list() {
    return clone(flags);
  },
  async toggle(key, enabled) {
    flags = flags.map((flag) => (flag.key === key ? { ...flag, enabled } : flag));
    return clone(flags);
  },
};

export const memoryWorkspaceRepository: WorkspaceRepository = {
  async get(idValue) {
    return idValue === workspace.id ? clone(workspace) : null;
  },
  async update(idValue, patch) {
    if (idValue !== workspace.id) throw new Error("Workspace not found");
    workspace = { ...workspace, ...patch };
    return clone(workspace);
  },
};

export const memoryUserRepository: UserRepository = {
  async findByEmail(email) {
    return clone(users.find((u) => u.email === email.toLowerCase()) ?? null);
  },
  async upsertByEmail(email) {
    const normalized = email.toLowerCase();
    const existing = users.find((u) => u.email === normalized);
    if (existing) return clone(existing);
    const created: User = {
      id: id("usr"),
      email: normalized,
      displayName: normalized.split("@")[0] ?? "member",
      workspaceId: WORKSPACE_ID,
    };
    users.push(created);
    return clone(created);
  },
};

/** AES-GCM envelope encryption for every credential that hits persistence. */
export const aesSecretManager: SecretManager = {
  seal: (plaintext) => sealValue(plaintext),
  open: (ciphertext) => openValue(ciphertext),
};

const tokens = new Map<string, string>();

export const memoryTokenRepository: TokenRepository = {
  async save(connectionId, sealedToken) {
    tokens.set(connectionId, sealedToken);
  },
  async read(connectionId) {
    return tokens.get(connectionId) ?? null;
  },
  async remove(connectionId) {
    tokens.delete(connectionId);
  },
};

export const DEMO_WORKSPACE_ID = WORKSPACE_ID;

/* --------------------------------- sharing --------------------------------- */

const shares: Share[] = [
  {
    id: "shr_brand_kit",
    workspaceId: WORKSPACE_ID,
    driveId: "drv_company",
    resourceType: "folder",
    resourceId: "file_brand_kit",
    resourceName: "brand-kit",
    token: "kq7f2mrz8w1xj4",
    createdBy: "you",
    shareType: "public",
    status: "active",
    expiresAt: "2026-09-05T09:00:00Z",
    passwordHash: null,
    allowDownload: true,
    allowPreview: true,
    maxDownloads: null,
    downloadCount: 34,
    createdAt: "2026-08-05T09:00:00Z",
    updatedAt: "2026-08-06T12:00:00Z",
  },
  {
    id: "shr_contract",
    workspaceId: WORKSPACE_ID,
    driveId: "drv_company",
    resourceType: "file",
    resourceId: "file_contract",
    resourceName: "vendor-contract.pdf",
    token: "p3d9tunb6ac0se",
    createdBy: "you",
    shareType: "password_protected",
    status: "active",
    expiresAt: "2026-08-12T18:00:00Z",
    // password: "odrive-demo" — hashed lazily on first verify in demo mode.
    passwordHash: null,
    allowDownload: true,
    allowPreview: false,
    maxDownloads: 10,
    downloadCount: 3,
    createdAt: "2026-08-06T18:00:00Z",
    updatedAt: "2026-08-06T18:00:00Z",
  },
  {
    id: "shr_reel",
    workspaceId: WORKSPACE_ID,
    driveId: "drv_media",
    resourceType: "file",
    resourceId: "file_reel",
    resourceName: "launch-reel-master.mov",
    token: "z8vh1qkd5np2ru",
    createdBy: "you",
    shareType: "public",
    status: "expired",
    expiresAt: "2026-08-01T00:00:00Z",
    passwordHash: null,
    allowDownload: true,
    allowPreview: true,
    maxDownloads: 25,
    downloadCount: 25,
    createdAt: "2026-07-20T10:00:00Z",
    updatedAt: "2026-08-01T00:00:00Z",
  },
];

const shareAccessLogs: ShareAccessLog[] = [
  {
    id: "sal_1",
    shareId: "shr_brand_kit",
    resourceId: "file_brand_kit",
    action: "download",
    status: "success",
    userId: null,
    ipHash: "hV82kdlsQm0",
    userAgent: "Mozilla/5.0 (Macintosh)",
    createdAt: "2026-08-06T12:00:00Z",
  },
  {
    id: "sal_2",
    shareId: "shr_contract",
    resourceId: "file_contract",
    action: "password_failed",
    status: "failed",
    userId: null,
    ipHash: "b71xPqzTme4",
    userAgent: "Mozilla/5.0 (Windows NT 10.0)",
    createdAt: "2026-08-06T19:22:00Z",
  },
  {
    id: "sal_3",
    shareId: "shr_brand_kit",
    resourceId: "file_brand_kit",
    action: "preview",
    status: "success",
    userId: null,
    ipHash: "kk02mAqzXe9",
    userAgent: "Mozilla/5.0 (iPhone)",
    createdAt: "2026-08-07T08:11:00Z",
  },
];

export const memoryShareRepository: ShareRepository = {
  async list(workspaceId) {
    return clone(shares.filter((share) => share.workspaceId === workspaceId));
  },
  async listAll() {
    return clone(shares);
  },
  async get(idValue) {
    return clone(shares.find((share) => share.id === idValue) ?? null);
  },
  async findByToken(token) {
    return clone(shares.find((share) => share.token === token) ?? null);
  },
  async create(input) {
    const now = new Date().toISOString();
    const created: Share = { ...input, id: id("shr"), createdAt: now, updatedAt: now };
    shares.unshift(created);
    return clone(created);
  },
  async update(idValue, patch) {
    const target = shares.find((share) => share.id === idValue);
    if (!target) throw new Error("Share not found");
    Object.assign(target, patch, { updatedAt: new Date().toISOString() });
    return clone(target);
  },
  async remove(idValue) {
    const index = shares.findIndex((share) => share.id === idValue);
    if (index >= 0) shares.splice(index, 1);
  },
};

export const memoryShareAccessLogRepository: ShareAccessLogRepository = {
  async list(filter = {}) {
    let list = [...shareAccessLogs].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    if (filter.shareId) list = list.filter((entry) => entry.shareId === filter.shareId);
    return clone(list.slice(0, filter.limit ?? 100));
  },
  async countForShare(shareId) {
    return shareAccessLogs.filter((entry) => entry.shareId === shareId).length;
  },
  async record(input) {
    const created: ShareAccessLog = { ...input, id: id("sal"), createdAt: new Date().toISOString() };
    shareAccessLogs.unshift(created);
    return clone(created);
  },
};

/* ------------------------------- automations ------------------------------- */

const automations: Automation[] = [
  {
    id: "atm_daily_backup",
    workspaceId: WORKSPACE_ID,
    name: "Daily backup",
    description: "Mirror the company drive into the archive vault every night.",
    status: "active",
    triggerType: "schedule",
    schedule: { interval: "daily", hour: 2 },
    conditionGroup: { match: "all", conditions: [] },
    actions: [
      {
        id: "act_backup_mirror",
        type: "mirror",
        orderIndex: 0,
        configuration: { sourceDriveId: "drv_company", targetDriveId: "drv_archive", path: "/" },
      },
    ],
    createdBy: "you",
    createdAt: "2026-07-18T09:00:00Z",
    updatedAt: "2026-08-08T02:00:00Z",
    lastRunAt: "2026-08-09T02:00:00Z",
    nextRunAt: "2026-08-10T02:00:00Z",
    runCount: 22,
    failureCount: 1,
    dangerous: false,
    maxDepth: 5,
  },
  {
    id: "atm_image_archive",
    workspaceId: WORKSPACE_ID,
    name: "Image archive",
    description: "Copy new images to the archive drive.",
    status: "active",
    triggerType: "file.created",
    conditionGroup: {
      match: "any",
      conditions: [
        { id: "cnd_jpg", field: "extension", operator: "equals", value: "jpg" },
        { id: "cnd_png", field: "extension", operator: "equals", value: "png" },
      ],
    },
    actions: [
      {
        id: "act_image_copy",
        type: "copy",
        orderIndex: 0,
        configuration: { targetDriveId: "drv_archive", targetPath: "/images", preserveMetadata: true },
      },
    ],
    createdBy: "you",
    createdAt: "2026-07-29T11:20:00Z",
    updatedAt: "2026-08-07T15:40:00Z",
    lastRunAt: "2026-08-09T18:12:00Z",
    runCount: 148,
    failureCount: 3,
    dangerous: false,
    maxDepth: 5,
  },
  {
    id: "atm_large_files",
    workspaceId: WORKSPACE_ID,
    name: "Large file routing",
    description: "Move anything above 500 MB out of hot storage.",
    status: "paused",
    triggerType: "upload.completed",
    conditionGroup: {
      match: "all",
      conditions: [
        { id: "cnd_size", field: "sizeBytes", operator: "greater_than", value: "524288000" },
      ],
    },
    actions: [
      {
        id: "act_large_move",
        type: "move",
        orderIndex: 0,
        configuration: { targetDriveId: "drv_archive", targetPath: "/cold", confirmed: true },
      },
      {
        id: "act_large_notify",
        type: "notify",
        orderIndex: 1,
        configuration: { message: "Large upload routed to cold storage" },
      },
    ],
    createdBy: "you",
    createdAt: "2026-08-02T08:05:00Z",
    updatedAt: "2026-08-08T09:15:00Z",
    lastRunAt: "2026-08-08T09:15:00Z",
    runCount: 9,
    failureCount: 0,
    dangerous: true,
    maxDepth: 5,
  },
];

const automationRuns: AutomationRun[] = [
  {
    id: "run_backup_1",
    automationId: "atm_daily_backup",
    automationName: "Daily backup",
    workspaceId: WORKSPACE_ID,
    status: "success",
    triggerSource: "schedule:daily",
    startedAt: "2026-08-09T02:00:00Z",
    completedAt: "2026-08-09T02:04:12Z",
    filesProcessed: 118,
    durationMs: 252000,
    depth: 0,
    eventChainId: "chain_backup_1",
    actions: [
      {
        id: "runact_backup_1",
        runId: "run_backup_1",
        actionId: "act_backup_mirror",
        actionType: "mirror",
        status: "success",
        idempotencyKey: "atm_daily_backup:act_backup_mirror:2026-08-09",
        message: "118 objects mirrored",
        startedAt: "2026-08-09T02:00:00Z",
        finishedAt: "2026-08-09T02:04:12Z",
      },
    ],
  },
  {
    id: "run_image_1",
    automationId: "atm_image_archive",
    automationName: "Image archive",
    workspaceId: WORKSPACE_ID,
    status: "failed",
    triggerSource: "event:file.created",
    startedAt: "2026-08-09T18:12:00Z",
    completedAt: "2026-08-09T18:12:09Z",
    filesProcessed: 0,
    durationMs: 9000,
    error: "Target drive quota exceeded",
    depth: 1,
    eventChainId: "chain_image_1",
    actions: [
      {
        id: "runact_image_1",
        runId: "run_image_1",
        actionId: "act_image_copy",
        actionType: "copy",
        status: "failed",
        idempotencyKey: "atm_image_archive:act_image_copy:file_hero",
        message: "Target drive quota exceeded",
        startedAt: "2026-08-09T18:12:00Z",
        finishedAt: "2026-08-09T18:12:09Z",
      },
    ],
  },
];

export const memoryAutomationRepository: AutomationRepository = {
  async list(workspaceId) {
    return clone(automations.filter((entry) => entry.workspaceId === workspaceId));
  },
  async listAll() {
    return clone(automations);
  },
  async get(idValue) {
    return clone(automations.find((entry) => entry.id === idValue) ?? null);
  },
  async create(input) {
    const now = new Date().toISOString();
    const created: Automation = { ...input, id: id("atm"), createdAt: now, updatedAt: now };
    automations.unshift(created);
    return clone(created);
  },
  async update(idValue, patch) {
    const target = automations.find((entry) => entry.id === idValue);
    if (!target) throw new Error("Automation not found");
    Object.assign(target, patch, { updatedAt: new Date().toISOString() });
    return clone(target);
  },
  async remove(idValue) {
    const index = automations.findIndex((entry) => entry.id === idValue);
    if (index >= 0) automations.splice(index, 1);
  },
};

export const memoryAutomationRunRepository: AutomationRunRepository = {
  async list(filter = {}) {
    let list = [...automationRuns].sort((a, b) => b.startedAt.localeCompare(a.startedAt));
    if (filter.automationId) list = list.filter((run) => run.automationId === filter.automationId);
    return clone(list.slice(0, filter.limit ?? 50));
  },
  async get(idValue) {
    return clone(automationRuns.find((run) => run.id === idValue) ?? null);
  },
  async create(input) {
    const created: AutomationRun = { ...input, id: id("run") };
    automationRuns.unshift(created);
    return clone(created);
  },
  async update(idValue, patch) {
    const target = automationRuns.find((run) => run.id === idValue);
    if (!target) throw new Error("Automation run not found");
    Object.assign(target, patch);
    return clone(target);
  },
  async appendAction(runId, action) {
    const run = automationRuns.find((entry) => entry.id === runId);
    if (!run) throw new Error("Automation run not found");
    const created: AutomationRunAction = { ...action, id: id("runact"), runId };
    run.actions.push(created);
    return clone(created);
  },
  async updateAction(runId, actionId, patch) {
    const run = automationRuns.find((entry) => entry.id === runId);
    const target = run?.actions.find((entry) => entry.id === actionId || entry.actionId === actionId);
    if (target) Object.assign(target, patch);
  },
  async findByIdempotencyKey(key) {
    for (const run of automationRuns) {
      const hit = run.actions.find(
        (action) => action.idempotencyKey === key && action.status === "success",
      );
      if (hit) return clone(hit);
    }
    return null;
  },
};
