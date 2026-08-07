import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { AdminNav } from "@/components/admin-nav";
import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { exportLogs, type LogFilter } from "@/core/logs";
import type { LogSeverity } from "@/core/types";
import { formatDateTime } from "@/lib/format";
import { systemLogsQuery } from "@/lib/queries";

export const Route = createFileRoute("/_authenticated/admin/logs")({
  head: () => ({
    meta: [
      { title: "System logs — ODrive admin" },
      { name: "description", content: "Searchable system log with severity filters and CSV or JSON export." },
      { property: "og:title", content: "System logs — ODrive admin" },
      { property: "og:description", content: "Severity filters, search and export." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdminLogs,
});

const SEVERITIES: LogSeverity[] = ["debug", "info", "warning", "error", "critical"];

const TONE: Record<LogSeverity, string> = {
  debug: "text-muted-foreground",
  info: "text-foreground",
  warning: "text-warning-foreground",
  error: "text-destructive",
  critical: "text-destructive font-semibold",
};

function AdminLogs() {
  const [filter, setFilter] = useState<LogFilter>({ limit: 200 });
  const logs = useQuery(systemLogsQuery(filter));

  const download = async (format: "csv" | "json") => {
    const content = await exportLogs(format, filter);
    const blob = new Blob([content], { type: format === "csv" ? "text/csv" : "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `odrive-logs.${format}`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <AppShell
      title="System logs"
      description="Structured events from every module, retained per policy."
      actions={
        <div className="flex gap-2">
          <Button size="sm" variant="secondary" onClick={() => void download("csv")}>
            Export CSV
          </Button>
          <Button size="sm" variant="secondary" onClick={() => void download("json")}>
            Export JSON
          </Button>
        </div>
      }
    >
      <AdminNav />

      <div className="panel mb-4 flex flex-wrap items-center gap-2 p-3">
        <Input
          placeholder="Search messages…"
          value={filter.search ?? ""}
          onChange={(event) =>
            setFilter((previous) => ({ ...previous, search: event.target.value || undefined }))
          }
          className="h-8 max-w-xs"
        />
        {SEVERITIES.map((severity) => (
          <Button
            key={severity}
            size="sm"
            variant={filter.severity === severity ? "default" : "ghost"}
            onClick={() =>
              setFilter((previous) => ({
                ...previous,
                severity: previous.severity === severity ? undefined : severity,
              }))
            }
          >
            {severity}
          </Button>
        ))}
      </div>

      <section className="panel divide-y divide-border">
        {(logs.data ?? []).map((entry) => (
          <div key={entry.id} className="flex flex-wrap items-baseline gap-3 px-4 py-2 text-sm">
            <span className="font-mono text-[11px] text-muted-foreground">
              {formatDateTime(entry.createdAt)}
            </span>
            <Badge variant="outline" className="text-[11px]">
              {entry.category}
            </Badge>
            <span className={`font-mono text-[11px] uppercase ${TONE[entry.severity]}`}>
              {entry.severity}
            </span>
            <span className="min-w-0 flex-1 truncate">{entry.message}</span>
          </div>
        ))}
        {!logs.data?.length ? (
          <p className="px-4 py-6 text-sm text-muted-foreground">No log entries match this filter.</p>
        ) : null}
      </section>
    </AppShell>
  );
}
