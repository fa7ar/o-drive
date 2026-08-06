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
  enqueue(input: Pick<BackgroundJob, "kind" | "payload">): Promise<BackgroundJob>;
  update(id: string, patch: Partial<BackgroundJob>): Promise<BackgroundJob>;
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
