import { registerAdapters } from "@/adapters";
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
import {
  aesSecretManager,
  memoryActivityRepository,
  memoryConnectionRepository,
  memoryFeatureFlagRepository,
  memoryFileRepository,
  memoryJobRepository,
  memoryProviderRepository,
  memorySearchRepository,
  memorySettingsRepository,
  memoryTokenRepository,
  memoryTransferRepository,
  memoryUserRepository,
  memoryWorkspaceRepository,
} from "@/database/memory";

/**
 * Dependency-injection container. Every service is resolved from here, so any
 * implementation can be replaced without touching business logic or the UI.
 */
export interface Container {
  connections: ConnectionRepository;
  providers: ProviderRepository;
  files: FileRepository;
  search: SearchRepository;
  transfers: TransferRepository;
  jobs: JobRepository;
  activity: ActivityRepository;
  settings: SettingsRepository;
  flags: FeatureFlagRepository;
  workspaces: WorkspaceRepository;
  users: UserRepository;
  tokens: TokenRepository;
  secrets: SecretManager;
}

let container: Container = {
  connections: memoryConnectionRepository,
  providers: memoryProviderRepository,
  files: memoryFileRepository,
  search: memorySearchRepository,
  transfers: memoryTransferRepository,
  jobs: memoryJobRepository,
  activity: memoryActivityRepository,
  settings: memorySettingsRepository,
  flags: memoryFeatureFlagRepository,
  workspaces: memoryWorkspaceRepository,
  users: memoryUserRepository,
  tokens: memoryTokenRepository,
  secrets: aesSecretManager,
};

registerAdapters();

/** Override any subset of dependencies (tests, future SQL backend). */
export function configureContainer(overrides: Partial<Container>): void {
  container = { ...container, ...overrides };
}

export function useContainer(): Container {
  return container;
}
