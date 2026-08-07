import { useContainer } from "./container";
import { listLogs } from "./logs";
import type { SystemMetrics } from "./types";

/**
 * System Health. Metrics are derived from repositories; CPU/memory are
 * placeholders until real instrumentation is wired to the runtime.
 */

export const THRESHOLDS = {
  latencyWarningMs: 2000,
  latencyErrorMs: 5000,
  providerOfflineCriticalMinutes: 5,
};

export async function systemMetrics(): Promise<SystemMetrics> {
  const { jobs, connections, providers, sync } = useContainer();
  const [jobList, connectionList, providerStates, syncJobs, config, logs] = await Promise.all([
    jobs.list(200),
    connections.list("ws_demo"),
    providers.list(),
    sync.list(50),
    useContainer().config.list(),
    listLogs({ limit: 500 }),
  ]);

  const workersTotal = Number(config.find((entry) => entry.key === "queue.workers")?.value ?? 4);
  const jobsRunning = jobList.filter((job) => job.status === "running").length;
  const lastSync = syncJobs.find((job) => job.finishedAt)?.finishedAt ?? null;

  return {
    cpuPercent: Math.min(95, 12 + jobsRunning * 9),
    memoryPercent: Math.min(95, 28 + jobList.length),
    workersActive: Math.min(workersTotal, jobsRunning),
    workersTotal,
    jobsRunning,
    jobsQueued: jobList.filter((job) => job.status === "queued").length,
    jobsFailed: jobList.filter((job) => job.status === "failed").length,
    connectionsActive: connectionList.filter((item) => item.status === "connected").length,
    providersHealthy: providerStates.filter((state) => state.health === "healthy").length,
    providersTotal: providerStates.length,
    storageUsedBytes: connectionList.reduce((total, item) => total + item.quotaUsedBytes, 0),
    storageTotalBytes: connectionList.reduce((total, item) => total + item.quotaTotalBytes, 0),
    lastSyncAt: lastSync ?? null,
    errorsCritical: logs.filter((entry) => entry.severity === "critical" || entry.severity === "error").length,
    errorsWarning: logs.filter((entry) => entry.severity === "warning").length,
    latencyMs: 180 + jobsRunning * 40,
  };
}

export type HealthLevel = "healthy" | "warning" | "critical";

export function latencyLevel(latencyMs: number): HealthLevel {
  if (latencyMs > THRESHOLDS.latencyErrorMs) return "critical";
  if (latencyMs > THRESHOLDS.latencyWarningMs) return "warning";
  return "healthy";
}

export function offlineLevel(checkedAt: string | null, health: string): HealthLevel {
  if (health === "healthy") return "healthy";
  if (!checkedAt) return "warning";
  const minutes = (Date.now() - new Date(checkedAt).getTime()) / 60_000;
  return minutes > THRESHOLDS.providerOfflineCriticalMinutes ? "critical" : "warning";
}
