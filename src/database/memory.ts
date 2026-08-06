import type {
  ActivityRepository,
  ConnectionRepository,
  FeatureFlagRepository,
  FileRepository,
  JobRepository,
  ProviderRepository,
  SearchRepository,
  SecretManager,
  SettingsRepository,
  TokenRepository,
  TransferRepository,
  UserRepository,
  WorkspaceRepository,
} from "@/core/repositories";
import type {
  ActivityLog,
  AppSettings,
  BackgroundJob,
  Connection,
  FeatureFlag,
  FileMetadata,
  ProviderState,
  SearchResult,
  TransferJob,
  User,
  Workspace,
} from "@/core/types";
import { DESCRIPTORS } from "@/adapters";
import { openValue, sealValue } from "@/core/crypto";
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
  async enqueue(input) {
    const created: BackgroundJob = {
      ...input,
      id: id("bg"),
      status: "queued",
      attempts: 0,
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
