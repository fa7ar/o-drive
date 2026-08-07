import type {
  ActivityRepository,
  ConfigRepository,
  ConnectionRepository,
  CredentialRepository,
  FeatureFlagRepository,
  FileRepository,
  JobLogRepository,
  JobRepository,
  ProviderRepository,
  SearchRepository,
  SecretManager,
  SettingsRepository,
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
  BackgroundJob,
  ConfigEntry,
  Connection,
  CredentialRecord,
  FeatureFlag,
  FileMetadata,
  JobLogEntry,
  ProviderState,
  SearchResult,
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

const jobs: BackgroundJob[] = [];

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
