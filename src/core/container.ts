import { registerAdapters } from "@/adapters";
import type {
  ActivityRepository,
  ApiKeyRepository,
  ApiRequestLogRepository,
  AutomationRepository,
  AutomationRunRepository,
  ConfigRepository,
  ConnectionRepository,
  CredentialRepository,
  DriveRepository,
  FeatureFlagRepository,
  FileRepository,
  JobLogRepository,
  JobRepository,
  ProviderRepository,
  SearchRepository,
  SecretManager,
  SettingsRepository,
  ShareAccessLogRepository,
  ShareRepository,
  SyncRepository,
  SystemLogRepository,
  TokenRepository,
  TransferRepository,
  UserRepository,
  WebhookDeliveryRepository,
  WebhookRepository,
  WorkspaceRepository,
} from "@/core/repositories";
import {
  aesSecretManager,
  memoryActivityRepository,
  memoryApiKeyRepository,
  memoryApiRequestLogRepository,
  memoryAutomationRepository,
  memoryAutomationRunRepository,
  memoryConfigRepository,
  memoryConnectionRepository,
  memoryCredentialRepository,
  memoryDriveRepository,
  memoryFeatureFlagRepository,
  memoryFileRepository,
  memoryJobLogRepository,
  memoryJobRepository,
  memoryProviderRepository,
  memorySearchRepository,
  memorySettingsRepository,
  memoryShareAccessLogRepository,
  memoryShareRepository,
  memorySyncRepository,
  memorySystemLogRepository,
  memoryTokenRepository,
  memoryTransferRepository,
  memoryUserRepository,
  memoryWebhookDeliveryRepository,
  memoryWebhookRepository,
  memoryWorkspaceRepository,
} from "@/database/memory";

/**
 * Dependency-injection container. Every service is resolved from here, so any
 * implementation can be replaced without touching business logic or the UI.
 */
export interface Container {
  connections: ConnectionRepository;
  drives: DriveRepository;
  providers: ProviderRepository;
  files: FileRepository;
  search: SearchRepository;
  transfers: TransferRepository;
  jobs: JobRepository;
  jobLogs: JobLogRepository;
  logs: SystemLogRepository;
  credentials: CredentialRepository;
  config: ConfigRepository;
  shares: ShareRepository;
  shareLogs: ShareAccessLogRepository;
  sync: SyncRepository;
  automations: AutomationRepository;
  automationRuns: AutomationRunRepository;
  activity: ActivityRepository;
  settings: SettingsRepository;
  flags: FeatureFlagRepository;
  workspaces: WorkspaceRepository;
  users: UserRepository;
  tokens: TokenRepository;
  secrets: SecretManager;
  apiKeys: ApiKeyRepository;
  webhooks: WebhookRepository;
  webhookDeliveries: WebhookDeliveryRepository;
  apiRequestLogs: ApiRequestLogRepository;
}

let container: Container = {
  connections: memoryConnectionRepository,
  drives: memoryDriveRepository,
  providers: memoryProviderRepository,
  files: memoryFileRepository,
  search: memorySearchRepository,
  transfers: memoryTransferRepository,
  jobs: memoryJobRepository,
  jobLogs: memoryJobLogRepository,
  logs: memorySystemLogRepository,
  credentials: memoryCredentialRepository,
  config: memoryConfigRepository,
  shares: memoryShareRepository,
  shareLogs: memoryShareAccessLogRepository,
  sync: memorySyncRepository,
  automations: memoryAutomationRepository,
  automationRuns: memoryAutomationRunRepository,
  activity: memoryActivityRepository,
  settings: memorySettingsRepository,
  flags: memoryFeatureFlagRepository,
  workspaces: memoryWorkspaceRepository,
  users: memoryUserRepository,
  tokens: memoryTokenRepository,
  secrets: aesSecretManager,
  apiKeys: memoryApiKeyRepository,
  webhooks: memoryWebhookRepository,
  webhookDeliveries: memoryWebhookDeliveryRepository,
  apiRequestLogs: memoryApiRequestLogRepository,
};

registerAdapters();

/** Override any subset of dependencies (tests, future SQL backend). */
export function configureContainer(overrides: Partial<Container>): void {
  container = { ...container, ...overrides };
}

export function useContainer(): Container {
  return container;
}
