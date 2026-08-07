import { useContainer } from "./container";
import { publish } from "./event-bus";
import type { LogCategory, LogSeverity, SystemLog } from "./types";

/**
 * Logging service. Every module writes through here so category, severity and
 * retention policy stay consistent and the store stays swappable.
 */

export interface LogFilter {
  category?: LogCategory | "all";
  severity?: LogSeverity | "all";
  providerId?: string | "all";
  term?: string;
  limit?: number;
}

export async function log(input: {
  category: LogCategory;
  severity: LogSeverity;
  message: string;
  providerId?: string;
  context?: Record<string, unknown>;
}): Promise<void> {
  const { logs } = useContainer();
  await logs.append(input);
  publish({ type: "log.appended", category: input.category });
}

export async function listLogs(filter: LogFilter = {}): Promise<SystemLog[]> {
  return useContainer().logs.list(filter);
}

export async function purgeLogs(days: number): Promise<number> {
  const removed = await useContainer().logs.purgeOlderThan(days);
  await log({
    category: "system",
    severity: "info",
    message: `Purged ${removed} log entries older than ${days} days`,
  });
  return removed;
}

const CSV_HEADER = "timestamp,category,severity,provider,message";

export function toCsv(entries: SystemLog[]): string {
  const rows = entries.map((entry) =>
    [
      entry.createdAt,
      entry.category,
      entry.severity,
      entry.providerId ?? "",
      `"${entry.message.replace(/"/g, '""')}"`,
    ].join(","),
  );
  return [CSV_HEADER, ...rows].join("\n");
}

export function toJson(entries: SystemLog[]): string {
  return JSON.stringify(entries, null, 2);
}
