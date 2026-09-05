/**
 * Core domain types. Vendor agnostic — nothing here references a concrete
 * storage provider, database driver or HTTP client.
 */

export type ProviderId = "google-drive" | "onedrive" | "telegram" | "r2" | "s3";

export type ConnectionStatus = "connected" | "disconnected" | "error" | "pending" | "expired";

export type AuthKind = "oauth" | "api-key" | "bot-token";

/** Launch maturity of a provider integration, surfaced in every UI surface. */
export type ProviderReadiness = "production" | "beta" | "coming-soon";

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
  /** Launch maturity: production / beta / coming-soon. */
  readiness: ProviderReadiness;
  /** Operations verified end-to-end for this provider. */
  verifiedOperations?: string[];
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
  createdAt?: string;
  favorite: boolean;
  trashed: boolean;
  /** ODrive metadata: user-defined tags. Never written back to the provider. */
  tags?: string[];
  /** ODrive metadata: last time the user opened this file (drives "Recent"). */
  lastOpenedAt?: string | null;
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
  | "retry"
  | "automation";
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
  | "sync"
  | "share"
  | "automation";

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
  /** Optional capability: presigned/temporary URL (S3, R2). */
  getTemporaryDownloadUrl?(
    connectionId: string,
    fileId: string,
    expiresInSeconds?: number,
  ): Promise<string | null>;
  /** Optional capability: streamed download for large files. */
  getDownloadStream?(connectionId: string, fileId: string): Promise<ReadableStream<Uint8Array> | null>;
  /** Optional capability: inline preview stream (images, PDF, text). */
  getPreviewStream?(connectionId: string, fileId: string): Promise<ReadableStream<Uint8Array> | null>;
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

/* --------------------------------- sharing --------------------------------- */

export type ShareResourceType = "file" | "folder";
export type ShareType = "public" | "private" | "password_protected";
export type ShareStatus = "active" | "expired" | "revoked" | "limit_reached";

export interface Share {
  id: string;
  workspaceId: string;
  driveId: string;
  resourceType: ShareResourceType;
  resourceId: string;
  /** Denormalised label so public pages never touch provider metadata. */
  resourceName: string;
  /** Opaque, cryptographically random public token (never an internal id). */
  token: string;
  createdBy: string;
  shareType: ShareType;
  status: ShareStatus;
  expiresAt: string | null;
  /** PBKDF2 hash. Plaintext passwords are never stored. */
  passwordHash: string | null;
  allowDownload: boolean;
  allowPreview: boolean;
  maxDownloads: number | null;
  downloadCount: number;
  createdAt: string;
  updatedAt: string;
}

export type ShareAccessAction = "preview" | "download" | "password_failed" | "view";
export type ShareAccessStatus = "success" | "failed";

export interface ShareAccessLog {
  id: string;
  shareId: string;
  resourceId: string;
  action: ShareAccessAction;
  status: ShareAccessStatus;
  userId: string | null;
  ipHash: string | null;
  userAgent: string;
  createdAt: string;
}

/** Read model joining a share with its drive and resource context. */
export interface ShareView {
  share: Share;
  driveName: string;
  providerId: string | null;
  accessCount: number;
}

export type ShareErrorCode =
  | "SHARE_NOT_FOUND"
  | "SHARE_EXPIRED"
  | "SHARE_REVOKED"
  | "PASSWORD_REQUIRED"
  | "INVALID_PASSWORD"
  | "DOWNLOAD_LIMIT_REACHED"
  | "RESOURCE_NOT_FOUND"
  | "PROVIDER_UNAVAILABLE"
  | "DOWNLOAD_NOT_SUPPORTED"
  | "RATE_LIMITED";

/** Normalised, provider-agnostic public view of a shared resource. */
export interface PublicShareResource {
  token: string;
  resourceType: ShareResourceType;
  name: string;
  sizeBytes: number;
  mimeType: string;
  modifiedAt: string;
  allowDownload: boolean;
  allowPreview: boolean;
  expiresAt: string | null;
  downloadsRemaining: number | null;
  requiresPassword: boolean;
  /** Folder shares expose their contents relative to the shared root only. */
  children?: Array<{
    id: string;
    name: string;
    kind: ShareResourceType;
    sizeBytes: number;
    mimeType: string;
    modifiedAt: string;
  }>;
}

export interface ShareSecurityPolicy {
  defaultExpiryHours: number;
  requirePasswordForPublic: boolean;
  minPasswordLength: number;
  maxPasswordAttempts: number;
  accessRatePerMinute: number;
  maxDownloadsDefault: number | null;
}

/* ------------------------------- automations ------------------------------- */

export type AutomationTriggerType =
  | "file.created"
  | "file.updated"
  | "file.deleted"
  | "file.moved"
  | "file.copied"
  | "upload.completed"
  | "transfer.completed"
  | "drive.connected"
  | "sync.completed"
  | "schedule"
  | "manual";

export type AutomationStatus = "active" | "paused" | "draft";

export type ScheduleInterval = "hourly" | "6h" | "daily" | "weekly" | "custom";

export interface AutomationSchedule {
  interval: ScheduleInterval;
  /** Hour of day (0-23) for daily/weekly schedules. */
  hour?: number;
  /** 0 = Sunday, used by weekly schedules. */
  weekday?: number;
  /** Custom interval in minutes. */
  everyMinutes?: number;
}

export type ConditionField =
  | "name"
  | "extension"
  | "mimeType"
  | "sizeBytes"
  | "path"
  | "createdAt"
  | "modifiedAt"
  | "driveId"
  | "providerId"
  | "connectionId"
  | "transferStatus";

export type ConditionOperator =
  | "equals"
  | "not_equals"
  | "contains"
  | "starts_with"
  | "ends_with"
  | "matches"
  | "greater_than"
  | "less_than"
  | "before"
  | "after";

export interface AutomationCondition {
  id: string;
  field: ConditionField;
  operator: ConditionOperator;
  value: string;
}

export interface ConditionGroup {
  match: "all" | "any";
  conditions: AutomationCondition[];
}

export type AutomationActionType =
  | "copy"
  | "move"
  | "delete"
  | "sync"
  | "mirror"
  | "archive"
  | "createFolder"
  | "tag.add"
  | "tag.remove"
  | "notify"
  | "webhook";

export type AutomationActionConfig = Record<string, string | number | boolean | null>;

export interface AutomationAction {
  id: string;
  type: AutomationActionType;
  orderIndex: number;
  configuration: AutomationActionConfig;
}

export interface Automation {
  id: string;
  workspaceId: string;
  name: string;
  description?: string;
  status: AutomationStatus;
  triggerType: AutomationTriggerType;
  schedule?: AutomationSchedule;
  conditionGroup: ConditionGroup;
  actions: AutomationAction[];
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  lastRunAt: string | null;
  nextRunAt?: string | null;
  runCount: number;
  failureCount: number;
  /** Contains a destructive action (delete / cross-drive move). */
  dangerous: boolean;
  /** Loop protection ceiling for chained events. */
  maxDepth: number;
}

export type AutomationRunStatus = "queued" | "running" | "success" | "partial" | "failed" | "skipped";

export interface AutomationRunAction {
  id: string;
  runId: string;
  actionId: string;
  actionType: AutomationActionType;
  status: AutomationRunStatus;
  idempotencyKey: string;
  message?: string;
  jobId?: string;
  startedAt: string;
  finishedAt?: string;
}

export interface AutomationRun {
  id: string;
  automationId: string;
  automationName: string;
  workspaceId: string;
  status: AutomationRunStatus;
  triggerSource: string;
  startedAt: string;
  completedAt: string | null;
  filesProcessed: number;
  durationMs: number;
  error?: string;
  depth: number;
  eventChainId: string;
  actions: AutomationRunAction[];
}

/** Normalised trigger payload. Providers are never referenced by the engine. */
export interface AutomationEvent {
  type: AutomationTriggerType;
  file?: FileMetadata;
  driveId?: string;
  connectionId?: string;
  providerId?: string;
  transferStatus?: string;
  /** Loop protection metadata. */
  eventChainId?: string;
  depth?: number;
  processedAutomationIds?: string[];
  source?: string;
}

export interface AutomationMetrics {
  total: number;
  active: number;
  paused: number;
  scheduled: number;
  runsToday: number;
  failedRuns: number;
  filesProcessed: number;
  avgDurationMs: number;
}

export interface AutomationTemplate {
  key: string;
  name: string;
  description: string;
  triggerType: AutomationTriggerType;
  schedule?: AutomationSchedule;
  conditionGroup: ConditionGroup;
  actions: Array<Omit<AutomationAction, "id">>;
}

/* ------------------------- developer platform (v1 API) ------------------- */

/** Least-privilege scopes exposed to external developers. */
export type ApiScope =
  | "drive:read"
  | "drive:write"
  | "file:read"
  | "file:write"
  | "transfer:write"
  | "share:read"
  | "webhook:write";

export type ApiKeyStatus = "active" | "revoked" | "expired";

export interface ApiKey {
  id: string;
  workspaceId: string;
  name: string;
  /** Public, non-secret identifier shown in the UI, e.g. odv_live_a1b2c3. */
  prefix: string;
  /** SHA-256 of the full secret. The raw secret is never stored. */
  hash: string;
  scopes: ApiScope[];
  status: ApiKeyStatus;
  createdAt: string;
  lastUsedAt?: string | null;
  expiresAt?: string | null;
  revokedAt?: string | null;
}

export type WebhookEventType =
  | "file.created"
  | "file.updated"
  | "file.deleted"
  | "transfer.completed"
  | "transfer.failed"
  | "drive.connected"
  | "share.accessed";

export interface WebhookEndpoint {
  id: string;
  workspaceId: string;
  url: string;
  events: WebhookEventType[];
  /** Signing secret (whsec_…), revealed once at creation. */
  secretMasked: string;
  status: "active" | "paused" | "failing";
  createdAt: string;
  failureCount: number;
  lastDeliveryAt?: string | null;
}

export interface WebhookDelivery {
  id: string;
  endpointId: string;
  /** Stable id used for consumer-side idempotency. */
  eventId: string;
  event: WebhookEventType;
  payload: Record<string, unknown>;
  status: "pending" | "delivered" | "failed" | "retrying";
  attempt: number;
  responseStatus?: number | null;
  error?: string | null;
  nextAttemptAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ApiRequestLog {
  id: string;
  requestId: string;
  keyId: string | null;
  method: string;
  path: string;
  status: number;
  durationMs: number;
  createdAt: string;
}
