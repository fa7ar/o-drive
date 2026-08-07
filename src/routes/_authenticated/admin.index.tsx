import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import { AdminNav } from "@/components/admin-nav";
import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { formatBytes, formatDateTime } from "@/lib/format";
import {
  activityQuery,
  connectionsQuery,
  jobsQuery,
  metricsQuery,
  providerStatesQuery,
  systemLogsQuery,
} from "@/lib/queries";

export const Route = createFileRoute("/_authenticated/admin/")({
  head: () => ({
    meta: [
      { title: "Admin dashboard — ODrive" },
      {
        name: "description",
        content: "Operational overview of ODrive: provider health, job queue depth and storage usage.",
      },
      { property: "og:title", content: "Admin dashboard — ODrive" },
      { property: "og:description", content: "Provider health, queue depth and storage usage." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdminDashboard,
});

function Metric({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="panel p-4">
      <p className="text-xs tracking-wide text-muted-foreground uppercase">{label}</p>
      <p className="mt-1 font-display text-2xl font-semibold">{value}</p>
      {hint ? <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

function AdminDashboard() {
  const metrics = useQuery(metricsQuery);
  const jobs = useQuery(jobsQuery);
  const providers = useQuery(providerStatesQuery);
  const connections = useQuery(connectionsQuery);
  const activity = useQuery(activityQuery);
  const logs = useQuery(systemLogsQuery({ limit: 6 }));

  const data = metrics.data;
  const storagePercent =
    data && data.storageTotalBytes > 0
      ? Math.round((data.storageUsedBytes / data.storageTotalBytes) * 100)
      : 0;

  return (
    <AppShell title="Admin console" description="System-wide operations, health and configuration.">
      <AdminNav />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric
          label="Jobs running"
          value={String(data?.jobsRunning ?? 0)}
          hint={`${data?.jobsQueued ?? 0} queued · ${data?.jobsFailed ?? 0} failed`}
        />
        <Metric
          label="Providers healthy"
          value={`${data?.providersHealthy ?? 0}/${data?.providersTotal ?? 0}`}
          hint={`${data?.connectionsActive ?? 0} active connections`}
        />
        <Metric
          label="Storage used"
          value={formatBytes(data?.storageUsedBytes ?? 0)}
          hint={`${storagePercent}% of ${formatBytes(data?.storageTotalBytes ?? 0)}`}
        />
        <Metric
          label="Errors (500 logs)"
          value={String(data?.errorsCritical ?? 0)}
          hint={`${data?.errorsWarning ?? 0} warnings`}
        />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <section className="panel p-5 lg:col-span-2">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-sm font-semibold">Queue activity</h2>
            <Link to="/admin/queues" className="text-xs text-primary hover:underline">
              Open queues
            </Link>
          </div>
          <ul className="mt-4 space-y-4">
            {(jobs.data ?? []).slice(0, 5).map((job) => (
              <li key={job.id}>
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="truncate">{job.label ?? job.kind}</span>
                  <span className="font-mono text-xs text-muted-foreground">
                    {job.status} · {job.priority}
                  </span>
                </div>
                <Progress value={job.progress ?? 0} className="mt-2 h-1.5" />
              </li>
            ))}
            {!jobs.data?.length ? (
              <li className="text-sm text-muted-foreground">Queue is empty.</li>
            ) : null}
          </ul>
        </section>

        <section className="panel p-5">
          <h2 className="font-display text-sm font-semibold">Provider health</h2>
          <ul className="mt-4 space-y-2">
            {(providers.data ?? []).map((state) => (
              <li key={state.providerId} className="flex items-center justify-between gap-2">
                <span className="font-mono text-xs">{state.providerId}</span>
                <Badge variant="outline" className="capitalize">
                  {state.health}
                </Badge>
              </li>
            ))}
          </ul>
        </section>

        <section className="panel p-5">
          <h2 className="font-display text-sm font-semibold">Storage by connection</h2>
          <ul className="mt-4 space-y-3">
            {(connections.data ?? []).map((connection) => (
              <li key={connection.id}>
                <div className="flex justify-between text-sm">
                  <span className="truncate">{connection.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {formatBytes(connection.quotaUsedBytes)}
                  </span>
                </div>
                <Progress
                  value={
                    connection.quotaTotalBytes
                      ? (connection.quotaUsedBytes / connection.quotaTotalBytes) * 100
                      : 0
                  }
                  className="mt-2 h-1.5"
                />
              </li>
            ))}
          </ul>
        </section>

        <section className="panel p-5">
          <h2 className="font-display text-sm font-semibold">Recent activity</h2>
          <ul className="mt-4 space-y-3 text-sm">
            {(activity.data ?? []).map((entry) => (
              <li key={entry.id}>
                <p className="font-mono text-xs text-muted-foreground">{entry.action}</p>
                <p className="truncate">{entry.target}</p>
              </li>
            ))}
          </ul>
        </section>

        <section className="panel p-5">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-sm font-semibold">Latest logs</h2>
            <Link to="/admin/logs" className="text-xs text-primary hover:underline">
              All logs
            </Link>
          </div>
          <ul className="mt-4 space-y-3 text-sm">
            {(logs.data ?? []).map((entry) => (
              <li key={entry.id}>
                <p className="font-mono text-[11px] text-muted-foreground">
                  {formatDateTime(entry.createdAt)} · {entry.category} · {entry.severity}
                </p>
                <p className="truncate">{entry.message}</p>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </AppShell>
  );
}
