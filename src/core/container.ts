import { registerAdapters } from "@/adapters";
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
import {
  base64SecretManager,
  memoryActivityRepository,
  memoryConnectionRepository,
  memoryFeatureFlagRepository,
  memoryFileRepository,
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
  files: FileRepository;
  transfers: TransferRepository;
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
  files: memoryFileRepository,
  transfers: memoryTransferRepository,
  activity: memoryActivityRepository,
  settings: memorySettingsRepository,
  flags: memoryFeatureFlagRepository,
  workspaces: memoryWorkspaceRepository,
  users: memoryUserRepository,
  tokens: memoryTokenRepository,
  secrets: base64SecretManager,
};

registerAdapters();

/** Override any subset of dependencies (tests, future SQL backend). */
export function configureContainer(overrides: Partial<Container>): void {
  container = { ...container, ...overrides };
}

export function useContainer(): Container {
  return container;
}
