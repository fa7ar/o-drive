import { useContainer } from "@/core/container";
import type { ApiRequestLog } from "@/core/types";

/** Read model for API traffic shown in the developer portal. */
export async function listApiRequestLogs(limit = 60, keyId?: string): Promise<ApiRequestLog[]> {
  return useContainer().apiRequestLogs.list(keyId ? { keyId, limit } : { limit });
}

export interface ApiUsageSummary {
  total: number;
  errorRate: number;
  p95DurationMs: number;
}

export function summariseUsage(rows: ApiRequestLog[]): ApiUsageSummary {
  if (!rows.length) return { total: 0, errorRate: 0, p95DurationMs: 0 };
  const errors = rows.filter((row) => row.status >= 400).length;
  const durations = [...rows.map((row) => row.durationMs)].sort((a, b) => a - b);
  const index = Math.min(durations.length - 1, Math.floor(durations.length * 0.95));
  return {
    total: rows.length,
    errorRate: Math.round((errors / rows.length) * 100),
    p95DurationMs: durations[index]!,
  };
}
