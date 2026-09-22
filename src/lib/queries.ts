import { queryOptions } from "@tanstack/react-query";

import { listContent, listNavigationContent } from "@/core/content";

import { listApiKeys } from "@/core/api-keys";
import { listDeliveries, listWebhooks } from "@/core/webhooks";
import { listApiRequestLogs } from "@/core/api-usage";

import { listAllShares, listShareAccessLogs, listShares } from "@/core/shares";

import {
  getFile,
  getSettings,
  listActivity,
  listAllFiles,
  listConnections,
  listFlags,
  listProviderStates,
  listTransfers,
} from "@/core/services";
import {
  automationMetrics,
  listAllAutomations,
  listAutomations,
  listRuns,
} from "@/core/automations";
import { listConfig } from "@/core/configurations";
import { listDrives } from "@/core/drives";
import { listCredentials } from "@/core/credentials";
import { systemMetrics } from "@/core/health";
import { jobLog, listJobs } from "@/core/jobs";
import { listLogs, type LogFilter } from "@/core/logs";
import { listModules } from "@/core/modules";
import { readinessReport } from "@/core/readiness";
import { listSyncHistory, listSyncJobs } from "@/core/sync-engine";

export const contentQuery = queryOptions({
  queryKey: ["content"],
  queryFn: () => listContent(),
});

export const headerContentQuery = queryOptions({
  queryKey: ["content", "nav", "header"],
  queryFn: () => listNavigationContent("header"),
});

export const footerContentQuery = queryOptions({
  queryKey: ["content", "nav", "footer"],
  queryFn: () => listNavigationContent("footer"),
});

export const connectionsQuery = queryOptions({
  queryKey: ["connections"],
  queryFn: () => listConnections(),
});

export const drivesQuery = queryOptions({
  queryKey: ["drives"],
  queryFn: () => listDrives(),
});

export const transfersQuery = queryOptions({
  queryKey: ["transfers"],
  queryFn: () => listTransfers(),
});

export const activityQuery = queryOptions({
  queryKey: ["activity"],
  queryFn: () => listActivity(8),
});

export const activityFeedQuery = queryOptions({
  queryKey: ["activity", "feed"],
  queryFn: () => listActivity(200),
});

export const settingsQuery = queryOptions({
  queryKey: ["settings"],
  queryFn: () => getSettings(),
});

export const flagsQuery = queryOptions({
  queryKey: ["flags"],
  queryFn: () => listFlags(),
});

export const filesQuery = (connectionIds: string[]) =>
  queryOptions({
    queryKey: ["files", [...connectionIds].sort()],
    queryFn: () => listAllFiles(connectionIds),
    enabled: connectionIds.length > 0,
  });

export const fileQuery = (fileId: string) =>
  queryOptions({
    queryKey: ["files", "detail", fileId],
    queryFn: () => getFile(fileId),
  });

/* --------------------------------- admin --------------------------------- */

export const providerStatesQuery = queryOptions({
  queryKey: ["provider-states"],
  queryFn: () => listProviderStates(),
});

export const jobsQuery = queryOptions({
  queryKey: ["jobs"],
  queryFn: () => listJobs(200),
  refetchInterval: 3000,
});

export const jobLogQuery = (jobId: string) =>
  queryOptions({
    queryKey: ["job-log", jobId],
    queryFn: () => jobLog(jobId),
  });

export const systemLogsQuery = (filter: LogFilter) =>
  queryOptions({
    queryKey: ["system-logs", filter],
    queryFn: () => listLogs(filter),
  });

export const credentialsQuery = queryOptions({
  queryKey: ["credentials"],
  queryFn: () => listCredentials(),
});

export const configQuery = queryOptions({
  queryKey: ["config"],
  queryFn: () => listConfig(),
});

export const syncJobsQuery = queryOptions({
  queryKey: ["sync-jobs"],
  queryFn: () => listSyncJobs(25),
});

export const syncHistoryQuery = queryOptions({
  queryKey: ["sync-history"],
  queryFn: () => listSyncHistory(25),
});

export const metricsQuery = queryOptions({
  queryKey: ["metrics"],
  queryFn: () => systemMetrics(),
  refetchInterval: 5000,
});

export const readinessQuery = queryOptions({
  queryKey: ["readiness"],
  queryFn: () => readinessReport(),
  refetchInterval: 8000,
});

export const modulesQuery = queryOptions({
  queryKey: ["modules"],
  queryFn: () => listModules(),
});

export const sharesQuery = queryOptions({
  queryKey: ["shares"],
  queryFn: () => listShares(),
});

export const allSharesQuery = queryOptions({
  queryKey: ["shares", "all"],
  queryFn: () => listAllShares(),
});

export const shareAccessLogsQuery = queryOptions({
  queryKey: ["share-access-logs"],
  queryFn: () => listShareAccessLogs({ limit: 60 }),
});

export const automationsQuery = queryOptions({
  queryKey: ["automations"],
  queryFn: () => listAutomations(),
});

export const allAutomationsQuery = queryOptions({
  queryKey: ["automations", "all"],
  queryFn: () => listAllAutomations(),
});

export const automationRunsQuery = (automationId?: string) =>
  queryOptions({
    queryKey: ["automation-runs", automationId ?? "all"],
    queryFn: () => listRuns(automationId ? { automationId, limit: 50 } : { limit: 50 }),
    refetchInterval: 5000,
  });

export const automationMetricsQuery = queryOptions({
  queryKey: ["automation-metrics"],
  queryFn: () => automationMetrics(),
  refetchInterval: 8000,
});

/* ---------------------------- developer platform -------------------------- */

export const apiKeysQuery = queryOptions({
  queryKey: ["api-keys"],
  queryFn: () => listApiKeys(),
});

export const webhooksQuery = queryOptions({
  queryKey: ["webhooks"],
  queryFn: () => listWebhooks(),
});

export const webhookDeliveriesQuery = queryOptions({
  queryKey: ["webhook-deliveries"],
  queryFn: () => listDeliveries(undefined, 40),
});

export const apiRequestLogsQuery = queryOptions({
  queryKey: ["api-request-logs"],
  queryFn: () => listApiRequestLogs(60),
  refetchInterval: 5000,
});
