import { queryOptions } from "@tanstack/react-query";

import {
  getSettings,
  listActivity,
  listAllFiles,
  listConnections,
  listFlags,
  listTransfers,
} from "@/core/services";

export const connectionsQuery = queryOptions({
  queryKey: ["connections"],
  queryFn: () => listConnections(),
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
