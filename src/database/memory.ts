import type {
  ActivityRepository,
  ConnectionRepository,
  FeatureFlagRepository,
  FileRepository,
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
  Connection,
  FeatureFlag,
  FileMetadata,
  TransferJob,
  User,
  Workspace,
} from "@/core/types";
import { fileStore } from "@/adapters";
import { seedFilesFor } from "@/adapters/mock-adapter";

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

for (const connection of connections) {
  fileStore.set(connection.id, seedFilesFor(connection.id));
}

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
    id: "job_2",
    connectionId: "conn_r2_1",
    fileName: "launch-video.mp4",
    direction: "upload",
    status: "running",
    progress: 62,
    sizeBytes: 940_000_000,
    createdAt: "2026-08-05T06:40:00Z",
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
  },
  {
    id: "job_4",
    connectionId: "conn_drive_1",
    fileName: "team-photo.jpg",
    direction: "download",
    status: "queued",
    progress: 0,
    sizeBytes: 5_180_000,
    createdAt: "2026-08-05T07:01:00Z",
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
};

let flags: FeatureFlag[] = [
  {
    key: "cross_provider_move",
    label: "Cross-provider move",
    description: "Move files between two connections in a single job.",
    enabled: true,
  },
  {
    key: "virtual_folders",
    label: "Virtual folders",
    description: "Unified folders spanning multiple providers.",
    enabled: false,
  },
  {
    key: "delta_sync",
    label: "Delta sync",
    description: "Incremental provider change polling.",
    enabled: false,
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
    fileStore.set(created.id, seedFilesFor(created.id));
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
    fileStore.delete(idValue);
  },
};

const allFiles = (connectionIds: string[]): FileMetadata[] =>
  connectionIds.flatMap((connectionId) => {
    if (!fileStore.has(connectionId)) fileStore.set(connectionId, seedFilesFor(connectionId));
    return fileStore.get(connectionId)!;
  });

export const memoryFileRepository: FileRepository = {
  async listByPath(connectionIds, path) {
    return clone(allFiles(connectionIds).filter((f) => f.path === path && !f.trashed));
  },
  async listAll(connectionIds) {
    return clone(allFiles(connectionIds));
  },
  async update(idValue, patch) {
    const target = allFiles([...fileStore.keys()]).find((f) => f.id === idValue);
    if (!target) throw new Error("File not found");
    Object.assign(target, patch);
    return clone(target);
  },
  async remove(idValue) {
    for (const [key, list] of fileStore) {
      const index = list.findIndex((f) => f.id === idValue);
      if (index >= 0) {
        list.splice(index, 1);
        fileStore.set(key, list);
        return;
      }
    }
  },
};

export const memoryTransferRepository: TransferRepository = {
  async list() {
    return clone(transfers);
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

/** Placeholder envelope encryption. Swap for KMS/Secret Manager in production. */
export const base64SecretManager: SecretManager = {
  async seal(plaintext) {
    return `enc:v1:${btoa(unescape(encodeURIComponent(plaintext)))}`;
  },
  async open(ciphertext) {
    return decodeURIComponent(escape(atob(ciphertext.replace(/^enc:v1:/, ""))));
  },
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
