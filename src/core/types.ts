/**
 * Core domain types. Vendor agnostic — nothing here references a concrete
 * storage provider, database driver or HTTP client.
 */

export type ProviderId = "google-drive" | "onedrive" | "telegram" | "r2" | "s3";

export type ConnectionStatus = "connected" | "disconnected" | "error" | "pending";

export interface ProviderDescriptor {
  id: ProviderId | string;
  name: string;
  tagline: string;
  /** lucide-react icon name resolved by the UI layer */
  icon: string;
  /** oklch token name used for the provider accent */
  accent: string;
  authKind: "oauth" | "api-key" | "bot-token";
  /** Fields the connect dialog should collect. */
  fields: Array<{ key: string; label: string; placeholder?: string; secret?: boolean }>;
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
}

export interface FileMetadata {
  id: string;
  connectionId: string;
  name: string;
  path: string;
  kind: "folder" | "file";
  mimeType: string;
  sizeBytes: number;
  modifiedAt: string;
  favorite: boolean;
  trashed: boolean;
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
  error?: string;
}

export interface ActivityLog {
  id: string;
  actor: string;
  action: string;
  target: string;
  createdAt: string;
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
}

export interface FeatureFlag {
  key: string;
  label: string;
  description: string;
  enabled: boolean;
}

/**
 * Every provider adapter implements this interface. Business logic depends on
 * this contract only — never on a vendor SDK.
 */
export interface StorageProvider {
  readonly descriptor: ProviderDescriptor;
  connect(input: Record<string, string>): Promise<Omit<Connection, "id" | "workspaceId">>;
  disconnect(connectionId: string): Promise<void>;
  upload(connectionId: string, file: { name: string; size: number }): Promise<FileMetadata>;
  download(connectionId: string, fileId: string): Promise<Blob>;
  list(connectionId: string, path?: string): Promise<FileMetadata[]>;
  delete(connectionId: string, fileId: string): Promise<void>;
  rename(connectionId: string, fileId: string, newName: string): Promise<void>;
  search(connectionId: string, query: string): Promise<FileMetadata[]>;
}
