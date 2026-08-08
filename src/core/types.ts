/**
 * Core domain types. Vendor agnostic — nothing here references a concrete
 * storage provider, database driver or HTTP client.
 */

export type ProviderId = "google-drive" | "onedrive" | "telegram" | "r2" | "s3";

export type ConnectionStatus = "connected" | "disconnected" | "error" | "pending" | "expired";

export type AuthKind = "oauth" | "api-key" | "bot-token";

export interface ProviderDescriptor {
  id: ProviderId | string;
  name: string;
  tagline: string;
  /** lucide-react icon name resolved by the UI layer */
  icon: string;
  /** oklch token name used for the provider accent */
  accent: string;
  authKind: AuthKind;
  /** Real vendor integration vs. mock adapter. */
  capability: "live" | "mock";
  /** OAuth scopes requested at connect time. */
  scopes?: string[];
  /** Fields the connect wizard should collect. */
  fields: Array<{ key: string; label: string; placeholder?: string; secret?: boolean }>;
}

export interface ProviderState {
  providerId: string;
  enabled: boolean;
  /** Result of the last healthCheck() run. */
  health: "unknown" | "healthy" | "degraded" | "down";
  checkedAt: string | null;
}

export interface Connection {
  id: string;
  workspaceId: string;
  providerId: string;
  name: string;
  accountLabel: string;
  status: ConnectionStatus;
  quotaUsedBytes: number;
  quotaTotalBytes: number;
  createdAt: string;
  /** Non-secret provider config (bucket, region, chat id, root folder…). */
  config?: Record<string, string>;
  lastError?: string;
}

export interface ProviderUser {
  id: string;
  label: string;
  email?: string;
}

export interface Quota {
  usedBytes: number;
  totalBytes: number;
}

export interface FileMetadata {
  id: string;
  connectionId: string;
  name: string;
  /** Virtual parent path, e.g. "/photos/2026". Always starts with "/". */
  path: string;
  kind: "folder" | "file";
  mimeType: string;
  sizeBytes: number;
  modifiedAt: string;
  favorite: boolean;
  trashed: boolean;
  /** Vendor-native identifier, hidden behind the virtual filesystem. */
  providerFileId?: string;
}

export type TransferDirection = "upload" | "download";
export type TransferStatus = "queued" | "running" | "completed" | "failed" | "cancelled";

export interface TransferJob {
  id: string;
  connectionId: string;
  fileName: string;
  direction: TransferDirection;
  status: TransferStatus;
  progress: number;
  sizeBytes: number;
  createdAt: string;
  path?: string;
  attempts?: number;
  error?: string;
}

export interface ActivityLog {
  id: string;
  actor: string;
  action: string;
  target: string;
  createdAt: string;
}

/** Background queue contract — shaped after Cloudflare Queues. */
export type JobKind =
  | "upload"
  | "download"
  | "delete"
  | "metadata.refresh"
  | "sync"
  | "transfer"
  | "retry";
export type JobStatus = "queued" | "running" | "done" | "failed" | "cancelled" | "paused";
export type JobPriority = "high" | "medium" | "low";

export interface BackgroundJob {
  id: string;
  kind: JobKind;
  payload: Record<string, unknown>;
  status: JobStatus;
  priority: JobPriority;
  attempts: number;
  maxAttempts: number;
  createdAt: string;
  finishedAt?: string;
  error?: string;
  label?: string;
  providerId?: string;
  connectionId?: string;
  progress?: number;
  bytesTotal?: number;
  bytesDone?: number;
  speedBytesPerSecond?: number;
  etaSeconds?: number;
  /** Job moved to the dead-letter queue after exhausting retries. */
  deadLettered?: boolean;
}

export interface JobLogEntry {
  id: string;
  jobId: string;
  createdAt: string;
  severity: LogSeverity;
  message: string;
}

/* ------------------------------ observability ----------------------------- */

export type LogCategory =
  | "system"
  | "connection"
  | "provider"
  | "queue"
  | "security"
  | "search"
  | "transfer"
  | "sync";

export type LogSeverity = "debug" | "info" | "warning" | "error" | "critical";

export interface SystemLog {
  id: string;
  category: LogCategory;
  severity: LogSeverity;
  message: string;
  providerId?: string;
  context?: Record<string, unknown>;
  createdAt: string;
}

export interface SystemMetrics {
  cpuPercent: number;
  memoryPercent: number;
  workersActive: number;
  workersTotal: number;
  jobsRunning: number;
  jobsQueued: number;
  jobsFailed: number;
  connectionsActive: number;
  providersHealthy: number;
  providersTotal: number;
  storageUsedBytes: number;
  storageTotalBytes: number;
  lastSyncAt: string | null;
  errorsCritical: number;
  errorsWarning: number;
  latencyMs: number;
}

/* -------------------------------- sync engine ------------------------------ */

export type SyncStatus = "queued" | "running" | "completed" | "paused" | "cancelled" | "failed";
export type ConflictResolution = "pending" | "keep-local" | "keep-remote";

export interface SyncConflict {
  id: string;
  path: string;
  name: string;
  localModifiedAt: string;
  remoteModifiedAt: string;
  resolution: ConflictResolution;
}

export interface SyncJob {
  id: string;
  connectionId: string;
  providerId: string;
  status: SyncStatus;
  scanned: number;
  added: number;
  updated: number;
  removed: number;
  conflicts: SyncConflict[];
  startedAt: string;
  finishedAt?: string;
  error?: string;
}

export interface SyncHistoryEntry {
  id: string;
  syncId: string;
  connectionId: string;
  changes: number;
  conflicts: number;
  createdAt: string;
}

/* ------------------------------- credentials ------------------------------- */

export type CredentialType = "oauth" | "api-key" | "secret" | "env";
export type CredentialStatus = "active" | "disabled";

export interface CredentialRecord {
  id: string;
  /** null for system-wide secrets (encryption keys, webhooks). */
  providerId: string | null;
  type: CredentialType;
  label: string;
  key: string;
  /** Never the plaintext — display value only. */
  maskedValue: string;
  status: CredentialStatus;
  createdAt: string;
  lastRotatedAt: string | null;
  /** Rotation SLA in days: OAuth 90, API keys 30. */
  rotationDays: number;
}

/* ------------------------------ configurations ----------------------------- */

export type ConfigSection =
  | "general"
  | "providers"
  | "security"
  | "storage"
  | "transfers"
  | "queue"
  | "search"
  | "logging";

export interface ConfigEntry {
  key: string;
  section: ConfigSection;
  label: string;
  description: string;
  type: "string" | "number" | "boolean" | "select";
  value: string | number | boolean;
  defaultValue: string | number | boolean;
  options?: string[];
}


export interface Workspace {
  id: string;
  name: string;
  plan: "free" | "pro" | "team";
}

export interface User {
  id: string;
  email: string;
  displayName: string;
  workspaceId: string;
}

export interface AppSettings {
  workspaceName: string;
  defaultConnectionId: string | null;
  concurrentTransfers: number;
  requireMagicLinkReauth: boolean;
  telemetry: boolean;
  apiKeyLabel: string;
  /** Storage */
  maxUploadMb: number;
  trashRetentionDays: number;
  /** Uploads */
  uploadRetries: number;
  /** Search */
  indexContents: boolean;
  searchResultLimit: number;
  /** Admin */
  maintenanceMode: boolean;
}

export interface FeatureFlag {
  key: string;
  label: string;
  description: string;
  enabled: boolean;
  group: "providers" | "core" | "experimental";
}

export type SearchResultType = "file" | "folder" | "connection" | "activity";

export interface SearchResult {
  type: SearchResultType;
  id: string;
  title: string;
  subtitle: string;
  path?: string;
  connectionId?: string;
}

/**
 * Every provider adapter implements this interface. Business logic depends on
 * this contract only — never on a vendor SDK.
 */
export interface StorageProvider {
  readonly descriptor: ProviderDescriptor;
  connect(input: Record<string, string>): Promise<Omit<Connection, "id" | "workspaceId">>;
  disconnect(connectionId: string): Promise<void>;
  refreshToken(connectionId: string): Promise<void>;
  getUser(connectionId: string): Promise<ProviderUser>;
  list(connectionId: string, path?: string): Promise<FileMetadata[]>;
  search(connectionId: string, query: string): Promise<FileMetadata[]>;
  upload(
    connectionId: string,
    file: { name: string; size: number; type?: string; blob?: Blob },
    path?: string,
  ): Promise<FileMetadata>;
  download(connectionId: string, fileId: string): Promise<Blob>;
  delete(connectionId: string, fileId: string): Promise<void>;
  rename(connectionId: string, fileId: string, newName: string): Promise<void>;
  move(connectionId: string, fileId: string, targetPath: string): Promise<void>;
  copy(connectionId: string, fileId: string, targetPath: string): Promise<FileMetadata>;
  createFolder(connectionId: string, path: string, name: string): Promise<FileMetadata>;
  getQuota(connectionId: string): Promise<Quota>;
  getMetadata(connectionId: string, fileId: string): Promise<FileMetadata | null>;
  healthCheck(): Promise<{ status: ProviderState["health"]; detail?: string }>;
}

/* ---------------------------------- drives --------------------------------- */

export type DriveStatus = "active" | "paused" | "error";

/**
 * A Drive is the user-facing storage entity. It is backed by exactly one
 * Connection (an authenticated provider account). A provider may back an
 * unlimited number of connections, and therefore an unlimited number of drives.
 */
export interface Drive {
  id: string;
  workspaceId: string;
  connectionId: string;
  name: string;
  description?: string;
  /** Provider-native root (folder id, bucket, chat id…). */
  rootReference?: string;
  status: DriveStatus;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
  lastSyncAt?: string | null;
  lastHealthCheckAt?: string | null;
  /** Generic key/value drive settings. */
  settings?: Record<string, string>;
}

/** Read model joining a drive with its connection and provider descriptor. */
export interface DriveView {
  drive: Drive;
  connection: Connection;
  descriptor: ProviderDescriptor | null;
}
