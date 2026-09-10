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
import { remoteRepository } from "@/database/remote";

/**
 * Dependency-injection container. Services and UI resolve persistence from
 * here, so the storage engine can change without touching business logic.
 *
 * The default wiring talks to the authenticated server bridge, which persists
 * everything in PostgreSQL. Tests (or a future engine) can replace any subset.
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
  connections: remoteRepository<ConnectionRepository>("connections"),
  drives: remoteRepository<DriveRepository>("drives"),
  providers: remoteRepository<ProviderRepository>("providers"),
  files: remoteRepository<FileRepository>("files"),
  search: remoteRepository<SearchRepository>("search"),
  transfers: remoteRepository<TransferRepository>("transfers"),
  jobs: remoteRepository<JobRepository>("jobs"),
  jobLogs: remoteRepository<JobLogRepository>("jobLogs"),
  logs: remoteRepository<SystemLogRepository>("logs"),
  credentials: remoteRepository<CredentialRepository>("credentials"),
  config: remoteRepository<ConfigRepository>("config"),
  shares: remoteRepository<ShareRepository>("shares"),
  shareLogs: remoteRepository<ShareAccessLogRepository>("shareLogs"),
  sync: remoteRepository<SyncRepository>("sync"),
  automations: remoteRepository<AutomationRepository>("automations"),
  automationRuns: remoteRepository<AutomationRunRepository>("automationRuns"),
  activity: remoteRepository<ActivityRepository>("activity"),
  settings: remoteRepository<SettingsRepository>("settings"),
  flags: remoteRepository<FeatureFlagRepository>("flags"),
  workspaces: remoteRepository<WorkspaceRepository>("workspaces"),
  users: remoteRepository<UserRepository>("users"),
  tokens: remoteRepository<TokenRepository>("tokens"),
  secrets: remoteRepository<SecretManager>("secrets"),
  apiKeys: remoteRepository<ApiKeyRepository>("apiKeys"),
  webhooks: remoteRepository<WebhookRepository>("webhooks"),
  webhookDeliveries: remoteRepository<WebhookDeliveryRepository>("webhookDeliveries"),
  apiRequestLogs: remoteRepository<ApiRequestLogRepository>("apiRequestLogs"),
};

registerAdapters();

/** Override any subset of dependencies (tests, alternative engines). */
export function configureContainer(overrides: Partial<Container>): void {
  container = { ...container, ...overrides };
}

export function useContainer(): Container {
  return container;
}
