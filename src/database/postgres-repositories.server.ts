import { DESCRIPTORS } from "@/adapters";
import { maskSecret, openValue, sealValue } from "@/core/crypto";
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
import type {
  ActivityLog,
  ApiKey,
  ApiRequestLog,
  AppSettings,
  Automation,
  AutomationRun,
  AutomationRunAction,
  AutomationSchedule,
  BackgroundJob,
  ConfigEntry,
  Connection,
  CredentialRecord,
  Drive,
  FeatureFlag,
  FileMetadata,
  JobLogEntry,
  ProviderState,
  SearchResult,
  Share,
  ShareAccessLog,
  SyncHistoryEntry,
  SyncJob,
  SystemLog,
  TransferJob,
  User,
  WebhookDelivery,
  WebhookEndpoint,
  Workspace,
} from "@/core/types";

import type { DatabaseAdapter, Filter, Row } from "./adapter";
import { eq, inList } from "./adapter";
import { DEFAULT_CONFIG, DEFAULT_FLAGS, DEFAULT_SETTINGS } from "./defaults";

/**
 * Postgres-backed repositories. They speak the same contracts as any other
 * implementation, hold no provider logic, and are always constructed for one
 * authenticated workspace so cross-workspace reads are impossible.
 */

const iso = (value: unknown): string =>
  typeof value === "string" ? value : new Date(String(value ?? Date.now())).toISOString();

const attrs = (row: Row): Record<string, unknown> => (row["attrs"] as Record<string, unknown>) ?? {};

const str = (value: unknown, fallback = ""): string => (typeof value === "string" ? value : fallback);
const num = (value: unknown, fallback = 0): number => (typeof value === "number" ? value : fallback);

export interface RepositoryBundle {
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

export interface RepositoryContext {
  workspaceId: string;
  userId: string;
  email: string;
}

export function createPostgresRepositories(
  db: DatabaseAdapter,
  ctx: RepositoryContext,
): RepositoryBundle {
  const ws = ctx.workspaceId;
  const scope = (extra: Filter[] = []): Filter[] => [eq("workspace_id", ws), ...extra];

  /* ------------------------------ connections ----------------------------- */

  const toConnection = (row: Row): Connection => {
    const a = attrs(row);
    return {
      id: String(row["id"]),
      workspaceId: String(row["workspace_id"]),
      providerId: String(row["provider_id"]),
      name: String(row["name"]),
      accountLabel: str(a["accountLabel"]),
      status: (row["status"] as Connection["status"]) ?? "pending",
      quotaUsedBytes: num(a["quotaUsedBytes"]),
      quotaTotalBytes: num(a["quotaTotalBytes"]),
      createdAt: iso(row["created_at"]),
      config: (a["config"] as Record<string, string>) ?? {},
      ...(a["lastError"] ? { lastError: String(a["lastError"]) } : {}),
    };
  };

  const connectionAttrs = (patch: Partial<Connection>, base: Record<string, unknown> = {}) => ({
    ...base,
    ...(patch.accountLabel === undefined ? {} : { accountLabel: patch.accountLabel }),
    ...(patch.quotaUsedBytes === undefined ? {} : { quotaUsedBytes: patch.quotaUsedBytes }),
    ...(patch.quotaTotalBytes === undefined ? {} : { quotaTotalBytes: patch.quotaTotalBytes }),
    ...(patch.config === undefined ? {} : { config: patch.config }),
    ...(patch.lastError === undefined ? {} : { lastError: patch.lastError }),
  });

  const connections: ConnectionRepository = {
    async list() {
      const rows = await db.select("connections", {
        filters: scope(),
        order: { column: "created_at", ascending: false },
      });
      return rows.map(toConnection);
    },
    async get(id) {
      const row = await db.selectOne("connections", scope([eq("id", id)]));
      return row ? toConnection(row) : null;
    },
    async create(input) {
      const row = await db.insert("connections", {
        workspace_id: ws,
        provider_id: input.providerId,
        name: input.name,
        status: input.status,
        attrs: connectionAttrs(input),
      });
      return toConnection(row);
    },
    async update(id, patch) {
      const current = await db.selectOne("connections", scope([eq("id", id)]));
      if (!current) throw new Error("Connection not found");
      const [row] = await db.update("connections", scope([eq("id", id)]), {
        ...(patch.name === undefined ? {} : { name: patch.name }),
        ...(patch.status === undefined ? {} : { status: patch.status }),
        attrs: connectionAttrs(patch, attrs(current)),
      });
      return toConnection(row!);
    },
    async remove(id) {
      await db.remove("connections", scope([eq("id", id)]));
    },
  };

  /* -------------------------------- drives -------------------------------- */

  const toDrive = (row: Row): Drive => {
    const a = attrs(row);
    return {
      id: String(row["id"]),
      workspaceId: String(row["workspace_id"]),
      connectionId: String(row["connection_id"]),
      name: String(row["name"]),
      isDefault: Boolean(row["is_default"]),
      status: (a["status"] as Drive["status"]) ?? "active",
      createdAt: iso(row["created_at"]),
      updatedAt: iso(row["updated_at"]),
      ...(a["description"] ? { description: String(a["description"]) } : {}),
      ...(a["rootReference"] ? { rootReference: String(a["rootReference"]) } : {}),
      lastSyncAt: (a["lastSyncAt"] as string | null) ?? null,
      lastHealthCheckAt: (a["lastHealthCheckAt"] as string | null) ?? null,
      settings: (a["settings"] as Record<string, string>) ?? {},
    };
  };

  const driveAttrs = (patch: Partial<Drive>, base: Record<string, unknown> = {}) => ({
    ...base,
    ...(patch.status === undefined ? {} : { status: patch.status }),
    ...(patch.description === undefined ? {} : { description: patch.description }),
    ...(patch.rootReference === undefined ? {} : { rootReference: patch.rootReference }),
    ...(patch.lastSyncAt === undefined ? {} : { lastSyncAt: patch.lastSyncAt }),
    ...(patch.lastHealthCheckAt === undefined ? {} : { lastHealthCheckAt: patch.lastHealthCheckAt }),
    ...(patch.settings === undefined ? {} : { settings: patch.settings }),
  });

  const drives: DriveRepository = {
    async list() {
      const rows = await db.select("drives", {
        filters: scope(),
        order: { column: "created_at", ascending: true },
      });
      return rows.map(toDrive);
    },
    async listByConnection(connectionId) {
      const rows = await db.select("drives", { filters: scope([eq("connection_id", connectionId)]) });
      return rows.map(toDrive);
    },
    async get(id) {
      const row = await db.selectOne("drives", scope([eq("id", id)]));
      return row ? toDrive(row) : null;
    },
    async create(input) {
      const existing = await db.select("drives", { filters: scope() });
      const row = await db.insert("drives", {
        workspace_id: ws,
        connection_id: input.connectionId,
        name: input.name,
        is_default: input.isDefault || existing.length === 0,
        attrs: driveAttrs(input),
      });
      return toDrive(row);
    },
    async update(id, patch) {
      const current = await db.selectOne("drives", scope([eq("id", id)]));
      if (!current) throw new Error("Drive not found");
      const [row] = await db.update("drives", scope([eq("id", id)]), {
        ...(patch.name === undefined ? {} : { name: patch.name }),
        ...(patch.isDefault === undefined ? {} : { is_default: patch.isDefault }),
        attrs: driveAttrs(patch, attrs(current)),
      });
      return toDrive(row!);
    },
    async setDefault(_workspaceId, id) {
      await db.update("drives", scope(), { is_default: false });
      await db.update("drives", scope([eq("id", id)]), { is_default: true });
      return drives.list(ws);
    },
    async remove(id) {
      await db.remove("drives", scope([eq("id", id)]));
    },
  };

  /* ------------------------------- providers ------------------------------- */

  const providers: ProviderRepository = {
    async list() {
      const rows = await db.select("provider_states", { filters: scope() });
      const byId = new Map(rows.map((row) => [String(row["provider_id"]), row]));
      return DESCRIPTORS.map((descriptor) => {
        const row = byId.get(descriptor.id);
        return {
          providerId: descriptor.id,
          enabled: row ? Boolean(row["enabled"]) : true,
          health: (row?.["health"] as ProviderState["health"]) ?? "unknown",
          checkedAt: (row?.["checked_at"] as string | null) ?? null,
        };
      });
    },
    async get(providerId) {
      const all = await providers.list();
      const found = all.find((state) => state.providerId === providerId);
      if (!found) throw new Error("Unknown provider");
      return found;
    },
    async update(providerId, patch) {
      const current = await providers.get(providerId);
      const next = { ...current, ...patch };
      await db.upsert(
        "provider_states",
        [
          {
            workspace_id: ws,
            provider_id: providerId,
            enabled: next.enabled,
            health: next.health,
            checked_at: next.checkedAt,
          },
        ],
        "workspace_id,provider_id",
      );
      return next;
    },
  };

  /* --------------------------------- files -------------------------------- */

  const toFile = (row: Row): FileMetadata => {
    const a = attrs(row);
    return {
      id: String(row["id"]),
      connectionId: String(row["connection_id"]),
      name: String(row["name"]),
      path: String(row["path"]),
      kind: (row["kind"] as FileMetadata["kind"]) ?? "file",
      mimeType: str(a["mimeType"], "application/octet-stream"),
      sizeBytes: num(a["sizeBytes"]),
      modifiedAt: iso(row["modified_at"]),
      createdAt: iso(row["created_at"]),
      favorite: Boolean(a["favorite"]),
      trashed: Boolean(a["trashed"]),
      tags: (a["tags"] as string[]) ?? [],
      lastOpenedAt: (a["lastOpenedAt"] as string | null) ?? null,
      ...(row["provider_file_id"] ? { providerFileId: String(row["provider_file_id"]) } : {}),
    };
  };

  const fileAttrs = (patch: Partial<FileMetadata>, base: Record<string, unknown> = {}) => ({
    ...base,
    ...(patch.mimeType === undefined ? {} : { mimeType: patch.mimeType }),
    ...(patch.sizeBytes === undefined ? {} : { sizeBytes: patch.sizeBytes }),
    ...(patch.favorite === undefined ? {} : { favorite: patch.favorite }),
    ...(patch.trashed === undefined ? {} : { trashed: patch.trashed }),
    ...(patch.tags === undefined ? {} : { tags: patch.tags }),
    ...(patch.lastOpenedAt === undefined ? {} : { lastOpenedAt: patch.lastOpenedAt }),
  });

  const fileRow = (connectionId: string, file: Partial<FileMetadata>) => ({
    workspace_id: ws,
    connection_id: connectionId,
    name: file.name ?? "untitled",
    path: file.path ?? "/",
    kind: file.kind ?? "file",
    provider_file_id: file.providerFileId ?? null,
    attrs: fileAttrs(file),
    modified_at: file.modifiedAt ?? new Date().toISOString(),
  });

  const files: FileRepository = {
    async listByPath(connectionIds, path) {
      if (connectionIds.length === 0) return [];
      const rows = await db.select("files", {
        filters: scope([inList("connection_id", connectionIds), eq("path", path)]),
        order: { column: "name", ascending: true },
      });
      return rows.map(toFile);
    },
    async listAll(connectionIds) {
      if (connectionIds.length === 0) return [];
      const rows = await db.select("files", {
        filters: scope([inList("connection_id", connectionIds)]),
        order: { column: "modified_at", ascending: false },
        limit: 5000,
      });
      return rows.map(toFile);
    },
    async get(id) {
      const row = await db.selectOne("files", scope([eq("id", id)]));
      return row ? toFile(row) : null;
    },
    async upsertMany(connectionId, listing) {
      const withProviderId = listing.filter((file) => file.providerFileId);
      const withoutProviderId = listing.filter((file) => !file.providerFileId);
      if (withProviderId.length > 0) {
        await db.upsert(
          "files",
          withProviderId.map((file) => fileRow(connectionId, file)),
          "connection_id,provider_file_id",
        );
      }
      for (const file of withoutProviderId) {
        const existing = await db.selectOne(
          "files",
          scope([eq("connection_id", connectionId), eq("path", file.path), eq("name", file.name)]),
        );
        if (existing) {
          await db.update("files", [eq("id", String(existing["id"]))], {
            kind: file.kind,
            modified_at: file.modifiedAt,
            attrs: fileAttrs(file, attrs(existing)),
          });
        } else {
          await db.insert("files", fileRow(connectionId, file));
        }
      }
    },
    async create(input) {
      const row = await db.insert("files", fileRow(input.connectionId, input));
      return toFile(row);
    },
    async update(id, patch) {
      const current = await db.selectOne("files", scope([eq("id", id)]));
      if (!current) throw new Error("File not found");
      const [row] = await db.update("files", scope([eq("id", id)]), {
        ...(patch.name === undefined ? {} : { name: patch.name }),
        ...(patch.path === undefined ? {} : { path: patch.path }),
        ...(patch.modifiedAt === undefined ? {} : { modified_at: patch.modifiedAt }),
        attrs: fileAttrs(patch, attrs(current)),
      });
      return toFile(row!);
    },
    async remove(id) {
      await db.remove("files", scope([eq("id", id)]));
    },
    async removeByConnection(connectionId) {
      await db.remove("files", scope([eq("connection_id", connectionId)]));
    },
  };

  /* -------------------------------- search -------------------------------- */

  const search: SearchRepository = {
    async query({ term, connectionIds, limit = 25 }) {
      const clean = term.trim();
      if (!clean || connectionIds.length === 0) return [];
      const rows = await db.select("files", {
        filters: scope([
          inList("connection_id", connectionIds),
          { column: "name", op: "ilike", value: `%${clean}%` },
        ]),
        limit,
      });
      const results: SearchResult[] = rows.map((row) => {
        const file = toFile(row);
        return {
          type: file.kind === "folder" ? "folder" : "file",
          id: file.id,
          title: file.name,
          subtitle: file.path,
          path: file.path,
          connectionId: file.connectionId,
        };
      });
      const connectionRows = await db.select("connections", {
        filters: scope([{ column: "name", op: "ilike", value: `%${clean}%` }]),
        limit: 5,
      });
      for (const row of connectionRows) {
        const connection = toConnection(row);
        results.push({
          type: "connection",
          id: connection.id,
          title: connection.name,
          subtitle: connection.accountLabel || connection.providerId,
        });
      }
      return results.slice(0, limit);
    },
  };

  /* ------------------------------- transfers ------------------------------ */

  const toTransfer = (row: Row): TransferJob => {
    const a = attrs(row);
    return {
      id: String(row["id"]),
      connectionId: str(row["connection_id"]),
      fileName: str(a["fileName"]),
      direction: (a["direction"] as TransferJob["direction"]) ?? "upload",
      status: (row["status"] as TransferJob["status"]) ?? "queued",
      progress: num(a["progress"]),
      sizeBytes: num(a["sizeBytes"]),
      createdAt: iso(row["created_at"]),
      ...(a["path"] ? { path: String(a["path"]) } : {}),
      attempts: num(a["attempts"]),
      ...(a["error"] ? { error: String(a["error"]) } : {}),
    };
  };

  const transferAttrs = (patch: Partial<TransferJob>, base: Record<string, unknown> = {}) => ({
    ...base,
    ...(patch.fileName === undefined ? {} : { fileName: patch.fileName }),
    ...(patch.direction === undefined ? {} : { direction: patch.direction }),
    ...(patch.progress === undefined ? {} : { progress: patch.progress }),
    ...(patch.sizeBytes === undefined ? {} : { sizeBytes: patch.sizeBytes }),
    ...(patch.path === undefined ? {} : { path: patch.path }),
    ...(patch.attempts === undefined ? {} : { attempts: patch.attempts }),
    ...(patch.error === undefined ? {} : { error: patch.error }),
  });

  const transfers: TransferRepository = {
    async list() {
      const rows = await db.select("transfers", {
        filters: scope(),
        order: { column: "created_at", ascending: false },
        limit: 200,
      });
      return rows.map(toTransfer);
    },
    async get(id) {
      const row = await db.selectOne("transfers", scope([eq("id", id)]));
      return row ? toTransfer(row) : null;
    },
    async create(input) {
      const row = await db.insert("transfers", {
        workspace_id: ws,
        connection_id: input.connectionId || null,
        status: input.status,
        attrs: transferAttrs(input),
      });
      return toTransfer(row);
    },
    async update(id, patch) {
      const current = await db.selectOne("transfers", scope([eq("id", id)]));
      if (!current) throw new Error("Transfer not found");
      const [row] = await db.update("transfers", scope([eq("id", id)]), {
        ...(patch.status === undefined ? {} : { status: patch.status }),
        attrs: transferAttrs(patch, attrs(current)),
      });
      return toTransfer(row!);
    },
    async remove(id) {
      await db.remove("transfers", scope([eq("id", id)]));
    },
  };

  /* --------------------------------- jobs --------------------------------- */

  const toJob = (row: Row): BackgroundJob => {
    const a = attrs(row);
    return {
      id: String(row["id"]),
      kind: row["kind"] as BackgroundJob["kind"],
      payload: (a["payload"] as Record<string, unknown>) ?? {},
      status: (row["status"] as BackgroundJob["status"]) ?? "queued",
      priority: (row["priority"] as BackgroundJob["priority"]) ?? "medium",
      attempts: num(a["attempts"]),
      maxAttempts: num(a["maxAttempts"], 3),
      createdAt: iso(row["created_at"]),
      ...(a["finishedAt"] ? { finishedAt: String(a["finishedAt"]) } : {}),
      ...(a["error"] ? { error: String(a["error"]) } : {}),
      ...(a["label"] ? { label: String(a["label"]) } : {}),
      ...(a["providerId"] ? { providerId: String(a["providerId"]) } : {}),
      ...(a["connectionId"] ? { connectionId: String(a["connectionId"]) } : {}),
      progress: num(a["progress"]),
      bytesTotal: num(a["bytesTotal"]),
      bytesDone: num(a["bytesDone"]),
      speedBytesPerSecond: num(a["speedBytesPerSecond"]),
      etaSeconds: num(a["etaSeconds"]),
      deadLettered: Boolean(a["deadLettered"]),
    };
  };

  const jobAttrs = (patch: Partial<BackgroundJob>, base: Record<string, unknown> = {}) => {
    const next = { ...base };
    const keys: Array<keyof BackgroundJob> = [
      "payload",
      "attempts",
      "maxAttempts",
      "finishedAt",
      "error",
      "label",
      "providerId",
      "connectionId",
      "progress",
      "bytesTotal",
      "bytesDone",
      "speedBytesPerSecond",
      "etaSeconds",
      "deadLettered",
    ];
    for (const key of keys) {
      if (patch[key] !== undefined) next[key as string] = patch[key];
    }
    return next;
  };

  const jobs: JobRepository = {
    async list(limit = 100) {
      const rows = await db.select("jobs", {
        filters: scope(),
        order: { column: "created_at", ascending: false },
        limit,
      });
      return rows.map(toJob);
    },
    async get(id) {
      const row = await db.selectOne("jobs", scope([eq("id", id)]));
      return row ? toJob(row) : null;
    },
    async enqueue(input) {
      const row = await db.insert("jobs", {
        workspace_id: ws,
        kind: input.kind,
        status: input.status ?? "queued",
        priority: input.priority ?? "medium",
        attrs: jobAttrs({ maxAttempts: 3, attempts: 0, ...input }),
      });
      return toJob(row);
    },
    async update(id, patch) {
      const current = await db.selectOne("jobs", scope([eq("id", id)]));
      if (!current) throw new Error("Job not found");
      const [row] = await db.update("jobs", scope([eq("id", id)]), {
        ...(patch.status === undefined ? {} : { status: patch.status }),
        ...(patch.priority === undefined ? {} : { priority: patch.priority }),
        attrs: jobAttrs(patch, attrs(current)),
      });
      return toJob(row!);
    },
  };

  const jobLogs: JobLogRepository = {
    async list(jobId) {
      const rows = await db.select("job_logs", {
        filters: [eq("job_id", jobId)],
        order: { column: "created_at", ascending: true },
      });
      return rows.map(
        (row): JobLogEntry => ({
          id: String(row["id"]),
          jobId: String(row["job_id"]),
          createdAt: iso(row["created_at"]),
          severity: row["severity"] as JobLogEntry["severity"],
          message: String(row["message"]),
        }),
      );
    },
    async append(input) {
      const row = await db.insert("job_logs", {
        job_id: input.jobId,
        severity: input.severity,
        message: input.message,
      });
      return {
        id: String(row["id"]),
        jobId: String(row["job_id"]),
        createdAt: iso(row["created_at"]),
        severity: row["severity"] as JobLogEntry["severity"],
        message: String(row["message"]),
      };
    },
  };

  /* ------------------------------ system logs ----------------------------- */

  const toSystemLog = (row: Row): SystemLog => ({
    id: String(row["id"]),
    category: row["category"] as SystemLog["category"],
    severity: row["severity"] as SystemLog["severity"],
    message: String(row["message"]),
    ...(row["provider_id"] ? { providerId: String(row["provider_id"]) } : {}),
    context: (row["context"] as Record<string, unknown>) ?? {},
    createdAt: iso(row["created_at"]),
  });

  const logs: SystemLogRepository = {
    async list(filter = {}) {
      const filters = scope();
      if (filter.category && filter.category !== "all") filters.push(eq("category", filter.category));
      if (filter.severity && filter.severity !== "all") filters.push(eq("severity", filter.severity));
      if (filter.providerId && filter.providerId !== "all")
        filters.push(eq("provider_id", filter.providerId));
      if (filter.term) filters.push({ column: "message", op: "ilike", value: `%${filter.term}%` });
      const rows = await db.select("system_logs", {
        filters,
        order: { column: "created_at", ascending: false },
        limit: filter.limit ?? 200,
      });
      return rows.map(toSystemLog);
    },
    async append(input) {
      const row = await db.insert("system_logs", {
        workspace_id: ws,
        category: input.category,
        severity: input.severity,
        message: input.message,
        provider_id: input.providerId ?? null,
        context: input.context ?? {},
      });
      return toSystemLog(row);
    },
    async purgeOlderThan(days) {
      const cutoff = new Date(Date.now() - days * 86_400_000).toISOString();
      const stale = await db.select("system_logs", {
        filters: scope([{ column: "created_at", op: "lt", value: cutoff }]),
        limit: 1000,
      });
      await db.remove("system_logs", scope([{ column: "created_at", op: "lt", value: cutoff }]));
      return stale.length;
    },
  };

  /* ------------------------------ credentials ----------------------------- */

  const toCredential = (row: Row): CredentialRecord => ({
    id: String(row["id"]),
    providerId: (row["provider_id"] as string | null) ?? null,
    type: row["type"] as CredentialRecord["type"],
    label: String(row["label"]),
    key: String(row["key"]),
    maskedValue: String(row["masked_value"]),
    status: row["status"] as CredentialRecord["status"],
    createdAt: iso(row["created_at"]),
    lastRotatedAt: (row["last_rotated_at"] as string | null) ?? null,
    rotationDays: num(row["rotation_days"], 90),
  });

  const credentials: CredentialRepository = {
    async list(providerId) {
      const filters = scope();
      if (providerId) filters.push(eq("provider_id", providerId));
      const rows = await db.select("credentials", {
        filters,
        order: { column: "created_at", ascending: false },
      });
      return rows.map(toCredential);
    },
    async get(id) {
      const row = await db.selectOne("credentials", scope([eq("id", id)]));
      return row ? toCredential(row) : null;
    },
    async save(input) {
      const sealed = await sealValue(input.plaintext);
      const existing = input.id
        ? await db.selectOne("credentials", scope([eq("id", input.id)]))
        : await db.selectOne(
            "credentials",
            scope([eq("provider_id", input.providerId), eq("key", input.key)]),
          );
      if (existing) {
        const [row] = await db.update("credentials", scope([eq("id", String(existing["id"]))]), {
          label: input.label,
          type: input.type,
          sealed_value: sealed,
          masked_value: maskSecret(input.plaintext),
          last_rotated_at: new Date().toISOString(),
          ...(input.rotationDays === undefined ? {} : { rotation_days: input.rotationDays }),
        });
        return toCredential(row!);
      }
      const row = await db.insert("credentials", {
        workspace_id: ws,
        provider_id: input.providerId,
        type: input.type,
        label: input.label,
        key: input.key,
        sealed_value: sealed,
        masked_value: maskSecret(input.plaintext),
        status: "active",
        rotation_days: input.rotationDays ?? (input.type === "oauth" ? 90 : 30),
        last_rotated_at: new Date().toISOString(),
      });
      return toCredential(row);
    },
    async reveal(id) {
      const row = await db.selectOne("credentials", scope([eq("id", id)]));
      if (!row) return null;
      try {
        return await openValue(String(row["sealed_value"]));
      } catch {
        return null;
      }
    },
    async rotate(id, plaintext) {
      const [row] = await db.update("credentials", scope([eq("id", id)]), {
        sealed_value: await sealValue(plaintext),
        masked_value: maskSecret(plaintext),
        last_rotated_at: new Date().toISOString(),
      });
      if (!row) throw new Error("Credential not found");
      return toCredential(row);
    },
    async setStatus(id, status) {
      const [row] = await db.update("credentials", scope([eq("id", id)]), { status });
      if (!row) throw new Error("Credential not found");
      return toCredential(row);
    },
    async remove(id) {
      await db.remove("credentials", scope([eq("id", id)]));
    },
  };

  /* ----------------------------- configuration ---------------------------- */

  const config: ConfigRepository = {
    async list() {
      const rows = await db.select("config_entries", { filters: scope() });
      const overrides = new Map(rows.map((row) => [String(row["key"]), row["value"]]));
      return DEFAULT_CONFIG.map((entry) => {
        const override = overrides.get(entry.key);
        return override === undefined ? entry : { ...entry, value: override as ConfigEntry["value"] };
      });
    },
    async set(key, value) {
      const definition = DEFAULT_CONFIG.find((entry) => entry.key === key);
      if (!definition) throw new Error("Unknown configuration key");
      await db.upsert("config_entries", [{ workspace_id: ws, key, value }], "workspace_id,key");
      return { ...definition, value };
    },
    async reset(key) {
      const definition = DEFAULT_CONFIG.find((entry) => entry.key === key);
      if (!definition) throw new Error("Unknown configuration key");
      await db.remove("config_entries", scope([eq("key", key)]));
      return { ...definition, value: definition.defaultValue };
    },
  };

  /* --------------------------------- sync --------------------------------- */

  const toSyncJob = (row: Row): SyncJob => {
    const a = attrs(row);
    return {
      id: String(row["id"]),
      connectionId: str(row["connection_id"]),
      providerId: str(a["providerId"]),
      status: (row["status"] as SyncJob["status"]) ?? "queued",
      scanned: num(a["scanned"]),
      added: num(a["added"]),
      updated: num(a["updated"]),
      removed: num(a["removed"]),
      conflicts: (a["conflicts"] as SyncJob["conflicts"]) ?? [],
      startedAt: iso(row["started_at"]),
      ...(a["finishedAt"] ? { finishedAt: String(a["finishedAt"]) } : {}),
      ...(a["error"] ? { error: String(a["error"]) } : {}),
    };
  };

  const syncAttrs = (patch: Partial<SyncJob>, base: Record<string, unknown> = {}) => {
    const next = { ...base };
    const keys: Array<keyof SyncJob> = [
      "providerId",
      "scanned",
      "added",
      "updated",
      "removed",
      "conflicts",
      "finishedAt",
      "error",
    ];
    for (const key of keys) if (patch[key] !== undefined) next[key as string] = patch[key];
    return next;
  };

  const sync: SyncRepository = {
    async list(limit = 25) {
      const rows = await db.select("sync_jobs", {
        filters: scope(),
        order: { column: "started_at", ascending: false },
        limit,
      });
      return rows.map(toSyncJob);
    },
    async get(id) {
      const row = await db.selectOne("sync_jobs", scope([eq("id", id)]));
      return row ? toSyncJob(row) : null;
    },
    async create(input) {
      const row = await db.insert("sync_jobs", {
        workspace_id: ws,
        connection_id: input.connectionId || null,
        status: input.status,
        attrs: syncAttrs(input),
      });
      return toSyncJob(row);
    },
    async update(id, patch) {
      const current = await db.selectOne("sync_jobs", scope([eq("id", id)]));
      if (!current) throw new Error("Sync job not found");
      const [row] = await db.update("sync_jobs", scope([eq("id", id)]), {
        ...(patch.status === undefined ? {} : { status: patch.status }),
        attrs: syncAttrs(patch, attrs(current)),
      });
      return toSyncJob(row!);
    },
    async history(limit = 25) {
      const rows = await db.select("sync_history", {
        filters: scope(),
        order: { column: "created_at", ascending: false },
        limit,
      });
      return rows.map(
        (row): SyncHistoryEntry => ({
          id: String(row["id"]),
          syncId: str(row["sync_id"]),
          connectionId: str(row["connection_id"]),
          changes: num(row["changes"]),
          conflicts: num(row["conflicts"]),
          createdAt: iso(row["created_at"]),
        }),
      );
    },
    async recordHistory(input) {
      const row = await db.insert("sync_history", {
        workspace_id: ws,
        sync_id: input.syncId,
        connection_id: input.connectionId,
        changes: input.changes,
        conflicts: input.conflicts,
      });
      return {
        id: String(row["id"]),
        syncId: str(row["sync_id"]),
        connectionId: str(row["connection_id"]),
        changes: num(row["changes"]),
        conflicts: num(row["conflicts"]),
        createdAt: iso(row["created_at"]),
      };
    },
  };

  /* -------------------------------- activity ------------------------------ */

  const activity: ActivityRepository = {
    async list(limit = 50) {
      const rows = await db.select("activity_logs", {
        filters: scope(),
        order: { column: "created_at", ascending: false },
        limit,
      });
      return rows.map(
        (row): ActivityLog => ({
          id: String(row["id"]),
          actor: String(row["actor"]),
          action: String(row["action"]),
          target: String(row["target"]),
          createdAt: iso(row["created_at"]),
        }),
      );
    },
    async record(input) {
      const row = await db.insert("activity_logs", {
        workspace_id: ws,
        actor: input.actor,
        action: input.action,
        target: input.target,
      });
      return {
        id: String(row["id"]),
        actor: String(row["actor"]),
        action: String(row["action"]),
        target: String(row["target"]),
        createdAt: iso(row["created_at"]),
      };
    },
  };

  /* --------------------------- settings and flags ------------------------- */

  const settings: SettingsRepository = {
    async get() {
      const row = await db.selectOne("workspace_settings", [eq("workspace_id", ws)]);
      const stored = (row?.["data"] as Partial<AppSettings>) ?? {};
      const workspace = await db.selectOne("workspaces", [eq("id", ws)]);
      return {
        ...DEFAULT_SETTINGS,
        workspaceName: str(workspace?.["name"], DEFAULT_SETTINGS.workspaceName),
        ...stored,
      };
    },
    async update(patch) {
      const current = await settings.get();
      const next = { ...current, ...patch };
      await db.upsert(
        "workspace_settings",
        [{ workspace_id: ws, data: next }],
        "workspace_id",
      );
      if (patch.workspaceName) await db.update("workspaces", [eq("id", ws)], { name: patch.workspaceName });
      return next;
    },
  };

  const flags: FeatureFlagRepository = {
    async list() {
      const rows = await db.select("feature_flags", { filters: scope() });
      const overrides = new Map(rows.map((row) => [String(row["key"]), Boolean(row["enabled"])]));
      return DEFAULT_FLAGS.map((flag): FeatureFlag => ({
        ...flag,
        enabled: overrides.get(flag.key) ?? flag.enabled,
      }));
    },
    async toggle(key, enabled) {
      await db.upsert("feature_flags", [{ workspace_id: ws, key, enabled }], "workspace_id,key");
      return flags.list();
    },
  };

  /* --------------------------- workspace and users ------------------------ */

  const workspaces: WorkspaceRepository = {
    async get(id) {
      const row = await db.selectOne("workspaces", [eq("id", id === "current" ? ws : id)]);
      if (!row) return null;
      return {
        id: String(row["id"]),
        name: String(row["name"]),
        plan: row["plan"] as Workspace["plan"],
      };
    },
    async update(id, patch) {
      const [row] = await db.update("workspaces", [eq("id", id === "current" ? ws : id)], {
        ...(patch.name === undefined ? {} : { name: patch.name }),
        ...(patch.plan === undefined ? {} : { plan: patch.plan }),
      });
      if (!row) throw new Error("Workspace not found");
      return { id: String(row["id"]), name: String(row["name"]), plan: row["plan"] as Workspace["plan"] };
    },
  };

  const toUser = (row: Row): User => ({
    id: String(row["id"]),
    email: String(row["email"]),
    displayName: str(row["display_name"]),
    workspaceId: String(row["workspace_id"]),
  });

  const users: UserRepository = {
    async findByEmail(email) {
      const row = await db.selectOne("profiles", [eq("email", email.toLowerCase())]);
      return row ? toUser(row) : null;
    },
    async upsertByEmail(email) {
      const existing = await users.findByEmail(email);
      if (existing) return existing;
      throw new Error("Accounts are created through sign-up, not directly");
    },
  };

  /* ------------------------------- tokens --------------------------------- */

  const tokens: TokenRepository = {
    async save(connectionId, sealedToken) {
      await db.upsert(
        "connection_tokens",
        [{ connection_id: connectionId, sealed_token: sealedToken }],
        "connection_id",
      );
    },
    async read(connectionId) {
      const row = await db.selectOne("connection_tokens", [eq("connection_id", connectionId)]);
      return row ? String(row["sealed_token"]) : null;
    },
    async remove(connectionId) {
      await db.remove("connection_tokens", [eq("connection_id", connectionId)]);
    },
  };

  const secrets: SecretManager = { seal: sealValue, open: openValue };

  /* -------------------------------- sharing ------------------------------- */

  const toShare = (row: Row): Share => {
    const a = attrs(row);
    return {
      id: String(row["id"]),
      workspaceId: String(row["workspace_id"]),
      driveId: str(row["drive_id"]),
      resourceType: (a["resourceType"] as Share["resourceType"]) ?? "file",
      resourceId: str(a["resourceId"]),
      resourceName: str(a["resourceName"]),
      token: String(row["token"]),
      createdBy: str(a["createdBy"], ctx.userId),
      shareType: (a["shareType"] as Share["shareType"]) ?? "public",
      status: (row["status"] as Share["status"]) ?? "active",
      expiresAt: (a["expiresAt"] as string | null) ?? null,
      passwordHash: (a["passwordHash"] as string | null) ?? null,
      allowDownload: a["allowDownload"] !== false,
      allowPreview: a["allowPreview"] !== false,
      maxDownloads: (a["maxDownloads"] as number | null) ?? null,
      downloadCount: num(a["downloadCount"]),
      createdAt: iso(row["created_at"]),
      updatedAt: iso(row["updated_at"]),
    };
  };

  const shareAttrs = (patch: Partial<Share>, base: Record<string, unknown> = {}) => {
    const next = { ...base };
    const keys: Array<keyof Share> = [
      "resourceType",
      "resourceId",
      "resourceName",
      "createdBy",
      "shareType",
      "expiresAt",
      "passwordHash",
      "allowDownload",
      "allowPreview",
      "maxDownloads",
      "downloadCount",
    ];
    for (const key of keys) if (patch[key] !== undefined) next[key as string] = patch[key];
    return next;
  };

  const shares: ShareRepository = {
    async list() {
      const rows = await db.select("shares", {
        filters: scope(),
        order: { column: "created_at", ascending: false },
      });
      return rows.map(toShare);
    },
    async listAll() {
      return shares.list(ws);
    },
    async get(id) {
      const row = await db.selectOne("shares", scope([eq("id", id)]));
      return row ? toShare(row) : null;
    },
    async findByToken(token) {
      // Public share pages resolve by token across workspaces by design.
      const row = await db.selectOne("shares", [eq("token", token)]);
      return row ? toShare(row) : null;
    },
    async create(input) {
      const row = await db.insert("shares", {
        workspace_id: ws,
        drive_id: input.driveId || null,
        token: input.token,
        status: input.status,
        attrs: shareAttrs(input),
      });
      return toShare(row);
    },
    async update(id, patch) {
      const current = await db.selectOne("shares", [eq("id", id)]);
      if (!current) throw new Error("Share not found");
      const [row] = await db.update("shares", [eq("id", id)], {
        ...(patch.status === undefined ? {} : { status: patch.status }),
        attrs: shareAttrs(patch, attrs(current)),
      });
      return toShare(row!);
    },
    async remove(id) {
      await db.remove("shares", scope([eq("id", id)]));
    },
  };

  const toShareLog = (row: Row): ShareAccessLog => {
    const a = attrs(row);
    return {
      id: String(row["id"]),
      shareId: String(row["share_id"]),
      resourceId: str(a["resourceId"]),
      action: (a["action"] as ShareAccessLog["action"]) ?? "view",
      status: (a["status"] as ShareAccessLog["status"]) ?? "success",
      userId: (a["userId"] as string | null) ?? null,
      ipHash: (a["ipHash"] as string | null) ?? null,
      userAgent: str(a["userAgent"]),
      createdAt: iso(row["created_at"]),
    };
  };

  const shareLogs: ShareAccessLogRepository = {
    async list(filter = {}) {
      const filters: Filter[] = [];
      if (filter.shareId) filters.push(eq("share_id", filter.shareId));
      const rows = await db.select("share_access_logs", {
        filters,
        order: { column: "created_at", ascending: false },
        limit: filter.limit ?? 60,
      });
      return rows.map(toShareLog);
    },
    async countForShare(shareId) {
      return db.count("share_access_logs", [eq("share_id", shareId)]);
    },
    async record(input) {
      const { shareId, ...rest } = input;
      const row = await db.insert("share_access_logs", { share_id: shareId, attrs: rest });
      return toShareLog(row);
    },
  };

  /* ------------------------------ automations ----------------------------- */

  const toAutomation = (row: Row): Automation => {
    const a = attrs(row);
    return {
      id: String(row["id"]),
      workspaceId: String(row["workspace_id"]),
      name: String(row["name"]),
      status: (row["status"] as Automation["status"]) ?? "draft",
      triggerType: (row["trigger_type"] as Automation["triggerType"]) ?? "manual",
      conditionGroup: (a["conditionGroup"] as Automation["conditionGroup"]) ?? {
        match: "all",
        conditions: [],
      },
      actions: (a["actions"] as Automation["actions"]) ?? [],
      createdBy: str(a["createdBy"], ctx.userId),
      createdAt: iso(row["created_at"]),
      updatedAt: iso(row["updated_at"]),
      lastRunAt: (a["lastRunAt"] as string | null) ?? null,
      nextRunAt: (a["nextRunAt"] as string | null) ?? null,
      runCount: num(a["runCount"]),
      failureCount: num(a["failureCount"]),
      dangerous: Boolean(a["dangerous"]),
      maxDepth: num(a["maxDepth"], 3),
      ...(a["description"] ? { description: String(a["description"]) } : {}),
      ...(a["schedule"] ? { schedule: a["schedule"] as AutomationSchedule } : {}),
    };
  };

  const automationAttrs = (patch: Partial<Automation>, base: Record<string, unknown> = {}) => {
    const next = { ...base };
    const keys: Array<keyof Automation> = [
      "description",
      "schedule",
      "conditionGroup",
      "actions",
      "createdBy",
      "lastRunAt",
      "nextRunAt",
      "runCount",
      "failureCount",
      "dangerous",
      "maxDepth",
    ];
    for (const key of keys) if (patch[key] !== undefined) next[key as string] = patch[key];
    return next;
  };

  const automations: AutomationRepository = {
    async list() {
      const rows = await db.select("automations", {
        filters: scope(),
        order: { column: "created_at", ascending: false },
      });
      return rows.map(toAutomation);
    },
    async listAll() {
      return automations.list(ws);
    },
    async get(id) {
      const row = await db.selectOne("automations", scope([eq("id", id)]));
      return row ? toAutomation(row) : null;
    },
    async create(input) {
      const row = await db.insert("automations", {
        workspace_id: ws,
        name: input.name,
        status: input.status,
        trigger_type: input.triggerType,
        attrs: automationAttrs(input),
      });
      return toAutomation(row);
    },
    async update(id, patch) {
      const current = await db.selectOne("automations", scope([eq("id", id)]));
      if (!current) throw new Error("Automation not found");
      const [row] = await db.update("automations", scope([eq("id", id)]), {
        ...(patch.name === undefined ? {} : { name: patch.name }),
        ...(patch.status === undefined ? {} : { status: patch.status }),
        ...(patch.triggerType === undefined ? {} : { trigger_type: patch.triggerType }),
        attrs: automationAttrs(patch, attrs(current)),
      });
      return toAutomation(row!);
    },
    async remove(id) {
      await db.remove("automations", scope([eq("id", id)]));
    },
  };

  const toRunAction = (row: Row): AutomationRunAction => {
    const a = attrs(row);
    return {
      id: String(row["id"]),
      runId: String(row["run_id"]),
      actionId: String(row["action_id"]),
      actionType: a["actionType"] as AutomationRunAction["actionType"],
      status: (row["status"] as AutomationRunAction["status"]) ?? "queued",
      idempotencyKey: String(row["idempotency_key"]),
      ...(a["message"] ? { message: String(a["message"]) } : {}),
      ...(a["jobId"] ? { jobId: String(a["jobId"]) } : {}),
      startedAt: iso(row["started_at"]),
      ...(a["finishedAt"] ? { finishedAt: String(a["finishedAt"]) } : {}),
    };
  };

  const toRun = (row: Row, actions: AutomationRunAction[]): AutomationRun => {
    const a = attrs(row);
    return {
      id: String(row["id"]),
      automationId: String(row["automation_id"]),
      automationName: str(a["automationName"]),
      workspaceId: String(row["workspace_id"]),
      status: (row["status"] as AutomationRun["status"]) ?? "queued",
      triggerSource: str(a["triggerSource"], "manual"),
      startedAt: iso(row["started_at"]),
      completedAt: (a["completedAt"] as string | null) ?? null,
      filesProcessed: num(a["filesProcessed"]),
      durationMs: num(a["durationMs"]),
      ...(a["error"] ? { error: String(a["error"]) } : {}),
      depth: num(a["depth"]),
      eventChainId: str(a["eventChainId"]),
      actions,
    };
  };

  const runAttrs = (patch: Partial<AutomationRun>, base: Record<string, unknown> = {}) => {
    const next = { ...base };
    const keys: Array<keyof AutomationRun> = [
      "automationName",
      "triggerSource",
      "completedAt",
      "filesProcessed",
      "durationMs",
      "error",
      "depth",
      "eventChainId",
    ];
    for (const key of keys) if (patch[key] !== undefined) next[key as string] = patch[key];
    return next;
  };

  const loadActions = async (runId: string) => {
    const rows = await db.select("automation_run_actions", {
      filters: [eq("run_id", runId)],
      order: { column: "started_at", ascending: true },
    });
    return rows.map(toRunAction);
  };

  const automationRuns: AutomationRunRepository = {
    async list(filter = {}) {
      const filters = scope();
      if (filter.automationId) filters.push(eq("automation_id", filter.automationId));
      const rows = await db.select("automation_runs", {
        filters,
        order: { column: "started_at", ascending: false },
        limit: filter.limit ?? 50,
      });
      return Promise.all(rows.map(async (row) => toRun(row, await loadActions(String(row["id"])))));
    },
    async get(id) {
      const row = await db.selectOne("automation_runs", scope([eq("id", id)]));
      return row ? toRun(row, await loadActions(String(row["id"]))) : null;
    },
    async create(input) {
      const row = await db.insert("automation_runs", {
        workspace_id: ws,
        automation_id: input.automationId,
        status: input.status,
        attrs: runAttrs(input),
      });
      return toRun(row, []);
    },
    async update(id, patch) {
      const current = await db.selectOne("automation_runs", scope([eq("id", id)]));
      if (!current) throw new Error("Automation run not found");
      const [row] = await db.update("automation_runs", scope([eq("id", id)]), {
        ...(patch.status === undefined ? {} : { status: patch.status }),
        attrs: runAttrs(patch, attrs(current)),
      });
      return toRun(row!, await loadActions(id));
    },
    async appendAction(runId, action) {
      const { actionId, idempotencyKey, status, ...rest } = action;
      const row = await db.insert("automation_run_actions", {
        run_id: runId,
        action_id: actionId,
        idempotency_key: idempotencyKey,
        status,
        attrs: rest,
      });
      return toRunAction(row);
    },
    async updateAction(_runId, actionId, patch) {
      const current = await db.selectOne("automation_run_actions", [eq("id", actionId)]);
      if (!current) return;
      const { status, ...rest } = patch;
      await db.update("automation_run_actions", [eq("id", actionId)], {
        ...(status === undefined ? {} : { status }),
        attrs: { ...attrs(current), ...rest },
      });
    },
    async findByIdempotencyKey(key) {
      const row = await db.selectOne("automation_run_actions", [eq("idempotency_key", key)]);
      return row ? toRunAction(row) : null;
    },
  };

  /* --------------------------- developer platform ------------------------- */

  const toApiKey = (row: Row): ApiKey => {
    const a = attrs(row);
    return {
      id: String(row["id"]),
      workspaceId: String(row["workspace_id"]),
      name: String(row["name"]),
      prefix: String(row["prefix"]),
      hash: String(row["hash"]),
      scopes: (a["scopes"] as ApiKey["scopes"]) ?? [],
      status: (row["status"] as ApiKey["status"]) ?? "active",
      createdAt: iso(row["created_at"]),
      lastUsedAt: (a["lastUsedAt"] as string | null) ?? null,
      expiresAt: (a["expiresAt"] as string | null) ?? null,
      revokedAt: (a["revokedAt"] as string | null) ?? null,
    };
  };

  const apiKeys: ApiKeyRepository = {
    async list() {
      const rows = await db.select("api_keys", {
        filters: scope(),
        order: { column: "created_at", ascending: false },
      });
      return rows.map(toApiKey);
    },
    async get(id) {
      const row = await db.selectOne("api_keys", scope([eq("id", id)]));
      return row ? toApiKey(row) : null;
    },
    async findByPrefix(prefix) {
      // API requests authenticate before a workspace is known.
      const row = await db.selectOne("api_keys", [eq("prefix", prefix)]);
      return row ? toApiKey(row) : null;
    },
    async create(input) {
      const row = await db.insert("api_keys", {
        workspace_id: ws,
        name: input.name,
        prefix: input.prefix,
        hash: input.hash,
        status: input.status,
        attrs: {
          scopes: input.scopes,
          lastUsedAt: input.lastUsedAt ?? null,
          expiresAt: input.expiresAt ?? null,
          revokedAt: input.revokedAt ?? null,
        },
      });
      return toApiKey(row);
    },
    async update(id, patch) {
      const current = await db.selectOne("api_keys", [eq("id", id)]);
      if (!current) throw new Error("API key not found");
      const base = attrs(current);
      const [row] = await db.update("api_keys", [eq("id", id)], {
        ...(patch.name === undefined ? {} : { name: patch.name }),
        ...(patch.status === undefined ? {} : { status: patch.status }),
        ...(patch.prefix === undefined ? {} : { prefix: patch.prefix }),
        ...(patch.hash === undefined ? {} : { hash: patch.hash }),
        attrs: {
          ...base,
          ...(patch.scopes === undefined ? {} : { scopes: patch.scopes }),
          ...(patch.lastUsedAt === undefined ? {} : { lastUsedAt: patch.lastUsedAt }),
          ...(patch.expiresAt === undefined ? {} : { expiresAt: patch.expiresAt }),
          ...(patch.revokedAt === undefined ? {} : { revokedAt: patch.revokedAt }),
        },
      });
      return toApiKey(row!);
    },
    async remove(id) {
      await db.remove("api_keys", scope([eq("id", id)]));
    },
  };

  const toWebhook = (row: Row): WebhookEndpoint => {
    const a = attrs(row);
    return {
      id: String(row["id"]),
      workspaceId: String(row["workspace_id"]),
      url: String(row["url"]),
      events: (a["events"] as WebhookEndpoint["events"]) ?? [],
      secretMasked: str(a["secretMasked"]),
      status: (row["status"] as WebhookEndpoint["status"]) ?? "active",
      createdAt: iso(row["created_at"]),
      failureCount: num(a["failureCount"]),
      lastDeliveryAt: (a["lastDeliveryAt"] as string | null) ?? null,
    };
  };

  const webhooks: WebhookRepository = {
    async list() {
      const rows = await db.select("webhook_endpoints", {
        filters: scope(),
        order: { column: "created_at", ascending: false },
      });
      return rows.map(toWebhook);
    },
    async get(id) {
      const row = await db.selectOne("webhook_endpoints", [eq("id", id)]);
      return row ? toWebhook(row) : null;
    },
    async create(input) {
      const row = await db.insert("webhook_endpoints", {
        workspace_id: ws,
        url: input.url,
        status: input.status,
        attrs: {
          events: input.events,
          secretMasked: input.secretMasked,
          failureCount: input.failureCount ?? 0,
          lastDeliveryAt: input.lastDeliveryAt ?? null,
        },
      });
      return toWebhook(row);
    },
    async update(id, patch) {
      const current = await db.selectOne("webhook_endpoints", [eq("id", id)]);
      if (!current) throw new Error("Webhook not found");
      const [row] = await db.update("webhook_endpoints", [eq("id", id)], {
        ...(patch.url === undefined ? {} : { url: patch.url }),
        ...(patch.status === undefined ? {} : { status: patch.status }),
        attrs: {
          ...attrs(current),
          ...(patch.events === undefined ? {} : { events: patch.events }),
          ...(patch.secretMasked === undefined ? {} : { secretMasked: patch.secretMasked }),
          ...(patch.failureCount === undefined ? {} : { failureCount: patch.failureCount }),
          ...(patch.lastDeliveryAt === undefined ? {} : { lastDeliveryAt: patch.lastDeliveryAt }),
        },
      });
      return toWebhook(row!);
    },
    async remove(id) {
      await db.remove("webhook_endpoints", scope([eq("id", id)]));
    },
  };

  const toDelivery = (row: Row): WebhookDelivery => {
    const a = attrs(row);
    return {
      id: String(row["id"]),
      endpointId: String(row["endpoint_id"]),
      eventId: String(row["event_id"]),
      event: a["event"] as WebhookDelivery["event"],
      payload: (a["payload"] as Record<string, unknown>) ?? {},
      status: (row["status"] as WebhookDelivery["status"]) ?? "pending",
      attempt: num(a["attempt"]),
      responseStatus: (a["responseStatus"] as number | null) ?? null,
      error: (a["error"] as string | null) ?? null,
      nextAttemptAt: (a["nextAttemptAt"] as string | null) ?? null,
      createdAt: iso(row["created_at"]),
      updatedAt: iso(row["updated_at"]),
    };
  };

  const webhookDeliveries: WebhookDeliveryRepository = {
    async list(filter = {}) {
      const filters: Filter[] = [];
      if (filter.endpointId) filters.push(eq("endpoint_id", filter.endpointId));
      const rows = await db.select("webhook_deliveries", {
        filters,
        order: { column: "created_at", ascending: false },
        limit: filter.limit ?? 40,
      });
      return rows.map(toDelivery);
    },
    async get(id) {
      const row = await db.selectOne("webhook_deliveries", [eq("id", id)]);
      return row ? toDelivery(row) : null;
    },
    async create(input) {
      const { endpointId, eventId, status, ...rest } = input;
      const row = await db.insert("webhook_deliveries", {
        endpoint_id: endpointId,
        event_id: eventId,
        status,
        attrs: rest,
      });
      return toDelivery(row);
    },
    async update(id, patch) {
      const current = await db.selectOne("webhook_deliveries", [eq("id", id)]);
      if (!current) throw new Error("Delivery not found");
      const { status, ...rest } = patch;
      const [row] = await db.update("webhook_deliveries", [eq("id", id)], {
        ...(status === undefined ? {} : { status }),
        attrs: { ...attrs(current), ...rest },
      });
      return toDelivery(row!);
    },
  };

  const apiRequestLogs: ApiRequestLogRepository = {
    async list(filter = {}) {
      const filters = scope();
      if (filter.keyId) filters.push(eq("key_id", filter.keyId));
      const rows = await db.select("api_request_logs", {
        filters,
        order: { column: "created_at", ascending: false },
        limit: filter.limit ?? 60,
      });
      return rows.map(
        (row): ApiRequestLog => ({
          id: String(row["id"]),
          requestId: String(row["request_id"]),
          keyId: (row["key_id"] as string | null) ?? null,
          method: String(row["method"]),
          path: String(row["path"]),
          status: num(row["status"]),
          durationMs: num(row["duration_ms"]),
          createdAt: iso(row["created_at"]),
        }),
      );
    },
    async record(input) {
      const row = await db.insert("api_request_logs", {
        workspace_id: ws,
        request_id: input.requestId,
        key_id: input.keyId,
        method: input.method,
        path: input.path,
        status: input.status,
        duration_ms: input.durationMs,
      });
      return {
        id: String(row["id"]),
        requestId: String(row["request_id"]),
        keyId: (row["key_id"] as string | null) ?? null,
        method: String(row["method"]),
        path: String(row["path"]),
        status: num(row["status"]),
        durationMs: num(row["duration_ms"]),
        createdAt: iso(row["created_at"]),
      };
    },
  };

  return {
    connections,
    drives,
    providers,
    files,
    search,
    transfers,
    jobs,
    jobLogs,
    logs,
    credentials,
    config,
    shares,
    shareLogs,
    sync,
    automations,
    automationRuns,
    activity,
    settings,
    flags,
    workspaces,
    users,
    tokens,
    secrets,
    apiKeys,
    webhooks,
    webhookDeliveries,
    apiRequestLogs,
  };
}
