import type {
  ActivityLog,
  AppSettings,
  BackgroundJob,
  Connection,
  ConfigEntry,
  CredentialRecord,
  Drive,
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
} from "./types";


/**
 * Repository contracts. The UI and services depend on these interfaces only,
 * so the in-memory implementation can be swapped for SQL/HTTP with no changes
 * to business logic. No provider logic lives inside a repository.
 */

export interface ConnectionRepository {
  list(workspaceId: string): Promise<Connection[]>;
  get(id: string): Promise<Connection | null>;
  create(input: Omit<Connection, "id" | "createdAt">): Promise<Connection>;
  update(id: string, patch: Partial<Connection>): Promise<Connection>;
  remove(id: string): Promise<void>;
}

export interface ProviderRepository {
  list(): Promise<ProviderState[]>;
  get(providerId: string): Promise<ProviderState>;
  update(providerId: string, patch: Partial<ProviderState>): Promise<ProviderState>;
}

/** Local metadata index — the source of truth for instant browse + search. */
export interface FileRepository {
  listByPath(connectionIds: string[], path: string): Promise<FileMetadata[]>;
  listAll(connectionIds: string[]): Promise<FileMetadata[]>;
  get(id: string): Promise<FileMetadata | null>;
  upsertMany(connectionId: string, files: FileMetadata[]): Promise<void>;
  create(input: Omit<FileMetadata, "id">): Promise<FileMetadata>;
  update(id: string, patch: Partial<FileMetadata>): Promise<FileMetadata>;
  remove(id: string): Promise<void>;
  removeByConnection(connectionId: string): Promise<void>;
}

export interface SearchRepository {
  query(input: {
    term: string;
    connectionIds: string[];
    limit?: number;
  }): Promise<SearchResult[]>;
}

export interface TransferRepository {
  list(): Promise<TransferJob[]>;
  get(id: string): Promise<TransferJob | null>;
  create(input: Omit<TransferJob, "id" | "createdAt">): Promise<TransferJob>;
  update(id: string, patch: Partial<TransferJob>): Promise<TransferJob>;
  remove(id: string): Promise<void>;
}

export interface JobRepository {
  list(limit?: number): Promise<BackgroundJob[]>;
  get(id: string): Promise<BackgroundJob | null>;
  enqueue(
    input: Pick<BackgroundJob, "kind" | "payload"> & Partial<BackgroundJob>,
  ): Promise<BackgroundJob>;
  update(id: string, patch: Partial<BackgroundJob>): Promise<BackgroundJob>;
}

export interface JobLogRepository {
  list(jobId: string): Promise<JobLogEntry[]>;
  append(input: Omit<JobLogEntry, "id" | "createdAt">): Promise<JobLogEntry>;
}

export interface SystemLogRepository {
  list(filter?: {
    category?: SystemLog["category"] | "all";
    severity?: SystemLog["severity"] | "all";
    providerId?: string | "all";
    term?: string;
    limit?: number;
  }): Promise<SystemLog[]>;
  append(input: Omit<SystemLog, "id" | "createdAt">): Promise<SystemLog>;
  purgeOlderThan(days: number): Promise<number>;
}

export interface CredentialRepository {
  list(providerId?: string): Promise<CredentialRecord[]>;
  get(id: string): Promise<CredentialRecord | null>;
  /** The plaintext is sealed by the SecretManager before it is persisted. */
  save(input: {
    id?: string;
    providerId: string | null;
    type: CredentialRecord["type"];
    label: string;
    key: string;
    plaintext: string;
    rotationDays?: number;
  }): Promise<CredentialRecord>;
  reveal(id: string): Promise<string | null>;
  rotate(id: string, plaintext: string): Promise<CredentialRecord>;
  setStatus(id: string, status: CredentialRecord["status"]): Promise<CredentialRecord>;
  remove(id: string): Promise<void>;
}

export interface ConfigRepository {
  list(): Promise<ConfigEntry[]>;
  set(key: string, value: ConfigEntry["value"]): Promise<ConfigEntry>;
  reset(key: string): Promise<ConfigEntry>;
}

export interface SyncRepository {
  list(limit?: number): Promise<SyncJob[]>;
  get(id: string): Promise<SyncJob | null>;
  create(input: Omit<SyncJob, "id" | "startedAt">): Promise<SyncJob>;
  update(id: string, patch: Partial<SyncJob>): Promise<SyncJob>;
  history(limit?: number): Promise<SyncHistoryEntry[]>;
  recordHistory(input: Omit<SyncHistoryEntry, "id" | "createdAt">): Promise<SyncHistoryEntry>;
}


export interface ActivityRepository {
  list(limit?: number): Promise<ActivityLog[]>;
  record(input: Omit<ActivityLog, "id" | "createdAt">): Promise<ActivityLog>;
}

export interface SettingsRepository {
  get(): Promise<AppSettings>;
  update(patch: Partial<AppSettings>): Promise<AppSettings>;
}

export interface FeatureFlagRepository {
  list(): Promise<FeatureFlag[]>;
  toggle(key: string, enabled: boolean): Promise<FeatureFlag[]>;
}

export interface WorkspaceRepository {
  get(id: string): Promise<Workspace | null>;
  update(id: string, patch: Partial<Workspace>): Promise<Workspace>;
}

export interface UserRepository {
  findByEmail(email: string): Promise<User | null>;
  upsertByEmail(email: string): Promise<User>;
}

export interface SecretManager {
  /** Encrypts a value before it ever reaches persistence. */
  seal(plaintext: string): Promise<string>;
  open(ciphertext: string): Promise<string>;
}

export interface TokenRepository {
  save(connectionId: string, sealedToken: string): Promise<void>;
  read(connectionId: string): Promise<string | null>;
  remove(connectionId: string): Promise<void>;
}

export interface DriveRepository {
  list(workspaceId: string): Promise<Drive[]>;
  listByConnection(connectionId: string): Promise<Drive[]>;
  get(id: string): Promise<Drive | null>;
  create(input: Omit<Drive, "id" | "createdAt" | "updatedAt">): Promise<Drive>;
  update(id: string, patch: Partial<Drive>): Promise<Drive>;
  setDefault(workspaceId: string, id: string): Promise<Drive[]>;
  remove(id: string): Promise<void>;
}
