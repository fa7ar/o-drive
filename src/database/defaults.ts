import type { AppSettings, ConfigEntry, FeatureFlag } from "@/core/types";

/**
 * Neutral defaults for a brand-new workspace. Nothing here is demo content —
 * these are the shipped defaults a real workspace starts from.
 */

export const DEFAULT_SETTINGS: AppSettings = {
  workspaceName: "My Workspace",
  displayName: "",
  defaultConnectionId: null,
  concurrentTransfers: 3,
  requireMagicLinkReauth: true,
  telemetry: false,
  apiKeyLabel: "",
  maxUploadMb: 512,
  trashRetentionDays: 30,
  uploadRetries: 2,
  indexContents: false,
  searchResultLimit: 25,
  maintenanceMode: false,
};

export const DEFAULT_FLAGS: FeatureFlag[] = [
  { key: "provider_google_drive", label: "Google Drive", description: "OAuth-backed Google Drive adapter.", enabled: true, group: "providers" },
  { key: "provider_r2", label: "Cloudflare R2", description: "S3-compatible R2 adapter.", enabled: true, group: "providers" },
  { key: "provider_s3", label: "Amazon S3", description: "SigV4 S3 adapter.", enabled: true, group: "providers" },
  { key: "provider_onedrive", label: "OneDrive", description: "Microsoft Graph adapter.", enabled: false, group: "providers" },
  { key: "provider_telegram", label: "Telegram", description: "Bot API storage adapter.", enabled: false, group: "providers" },
  { key: "upload_engine", label: "Upload engine", description: "Queued uploads with retry and cancel.", enabled: true, group: "core" },
  { key: "virtual_filesystem", label: "Virtual filesystem", description: "User-facing paths mapped to provider IDs.", enabled: true, group: "core" },
  { key: "metadata_index", label: "Metadata index", description: "Local index for instant browse.", enabled: true, group: "core" },
  { key: "local_search", label: "Local search", description: "Search the index without provider APIs.", enabled: true, group: "core" },
  { key: "cross_provider_move", label: "Cross-provider move", description: "Move files between two connections in one job.", enabled: false, group: "experimental" },
  { key: "delta_sync", label: "Delta sync", description: "Incremental provider change polling.", enabled: false, group: "experimental" },
];

export const DEFAULT_CONFIG: ConfigEntry[] = [
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
  { key: "queue.adapter", section: "queue", label: "Queue adapter", description: "Vendor-agnostic queue backend.", type: "select", value: "database", defaultValue: "database", options: ["database", "cloudflare-queue", "redis", "bullmq"] },
  { key: "queue.workers", section: "queue", label: "Worker count", description: "Concurrent workers consuming the queue.", type: "number", value: 4, defaultValue: 4 },
  { key: "queue.dead_letter", section: "queue", label: "Dead-letter queue", description: "Park permanently failing jobs instead of dropping them.", type: "boolean", value: true, defaultValue: true },
  { key: "search.index_interval_minutes", section: "search", label: "Index interval (minutes)", description: "How often the metadata index is refreshed.", type: "number", value: 15, defaultValue: 15 },
  { key: "search.index_contents", section: "search", label: "Index file contents", description: "Extract text from documents for full-text search.", type: "boolean", value: false, defaultValue: false },
  { key: "logging.retention_days", section: "logging", label: "Log retention (days)", description: "System logs older than this are purged.", type: "number", value: 30, defaultValue: 30 },
  { key: "logging.min_severity", section: "logging", label: "Minimum severity", description: "Lowest severity persisted to the log store.", type: "select", value: "info", defaultValue: "info", options: ["debug", "info", "warning", "error", "critical"] },
];
