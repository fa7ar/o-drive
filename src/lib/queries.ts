import { queryOptions } from "@tanstack/react-query";

import { listAllShares, listShareAccessLogs, listShares } from "@/core/shares";

import {
  getSettings,
  listActivity,
  listAllFiles,
  listConnections,
  listFlags,
  listProviderStates,
  listTransfers,
} from "@/core/services";
import { listConfig } from "@/core/configurations";
import { listDrives } from "@/core/drives";
import { listCredentials } from "@/core/credentials";
import { systemMetrics } from "@/core/health";
import { jobLog, listJobs } from "@/core/jobs";
import { listLogs, type LogFilter } from "@/core/logs";
import { listSyncHistory, listSyncJobs } from "@/core/sync-engine";

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
