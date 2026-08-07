import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import { AdminNav } from "@/components/admin-nav";
import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { latencyLevel, THRESHOLDS } from "@/core/health";
import { formatBytes, formatDateTime } from "@/lib/format";
import { metricsQuery, providerStatesQuery, systemLogsQuery } from "@/lib/queries";

export const Route = createFileRoute("/_authenticated/admin/health")({
  head: () => ({
    meta: [
      { title: "System health — ODrive admin" },
      { name: "description", content: "Live resource usage, provider latency and alert thresholds." },
      { property: "og:title", content: "System health — ODrive admin" },
      { property: "og:description", content: "Resource usage, latency and alert thresholds." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdminHealth,
});

function Gauge({ label, percent, hint }: { label: string; percent: number; hint?: string }) {
  return (
    <div className="panel p-4">
      <div className="flex justify-between text-sm">
        <span>{label}</span>
        <span className="font-mono text-xs text-muted-foreground">{Math.round(percent)}%</span>
      </div>
      <Progress value={percent} className="mt-2 h-1.5" />
      {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

function AdminHealth() {
  const metrics = useQuery(metricsQuery);
  const providers = useQuery(providerStatesQuery);
  const alerts = useQuery(systemLogsQuery({ limit: 20, severity: "error" }));
  const data = metrics.data;
  const level = latencyLevel(data?.latencyMs ?? 0);

  return (
    <AppShell title="System health" description="Refreshes every five seconds.">
      <AdminNav />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Gauge label="CPU" percent={data?.cpuPercent ?? 0} />
        <Gauge label="Memory" percent={data?.memoryPercent ?? 0} />
        <Gauge
          label="Workers"
          percent={data && data.workersTotal ? (data.workersActive / data.workersTotal) * 100 : 0}
          hint={`${data?.workersActive ?? 0}/${data?.workersTotal ?? 0} active`}
        />
        <Gauge
          label="Storage"
          percent={
            data && data.storageTotalBytes ? (data.storageUsedBytes / data.storageTotalBytes) * 100 : 0
          }
          hint={`${formatBytes(data?.storageUsedBytes ?? 0)} of ${formatBytes(data?.storageTotalBytes ?? 0)}`}
        />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <section className="panel p-5">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-sm font-semibold">Latency</h2>
            <Badge
              variant="outline"
              className={
                level === "healthy"
                  ? "border-success/30 bg-success/10 text-success"
                  : level === "warning"
                    ? "border-warning/30 bg-warning/15 text-warning-foreground"
                    : "border-destructive/30 bg-destructive/10 text-destructive"
              }
            >
              {data?.latencyMs ?? 0} ms
            </Badge>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Warning above {THRESHOLDS.latencyWarningMs} ms, critical above {THRESHOLDS.latencyErrorMs} ms.
            Provider offline longer than {THRESHOLDS.providerOfflineCriticalMinutes} minutes escalates to
            critical.
          </p>
          <p className="mt-2 font-mono text-[11px] text-muted-foreground">
            last sync: {data?.lastSyncAt ? formatDateTime(data.lastSyncAt) : "never"}
          </p>
        </section>

        <section className="panel p-5">
          <h2 className="font-display text-sm font-semibold">Provider status</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {(providers.data ?? []).map((state) => (
              <li key={state.providerId} className="flex items-center justify-between gap-2">
                <span className="font-mono text-xs">{state.providerId}</span>
                <span className="text-xs text-muted-foreground">
                  {state.health} · {state.checkedAt ? formatDateTime(state.checkedAt) : "never"}
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section className="panel p-5 lg:col-span-2">
          <h2 className="font-display text-sm font-semibold">Active alerts</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {(alerts.data ?? []).map((entry) => (
              <li key={entry.id} className="flex justify-between gap-3">
                <span className="truncate">{entry.message}</span>
                <span className="font-mono text-[11px] text-muted-foreground">
                  {formatDateTime(entry.createdAt)}
                </span>
              </li>
            ))}
            {!alerts.data?.length ? (
              <li className="text-muted-foreground">No errors recorded.</li>
            ) : null}
          </ul>
        </section>
      </div>
    </AppShell>
  );
}
