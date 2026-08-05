import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Files, HardDrive, Plug, Waypoints } from "lucide-react";

import { AddConnectionDialog } from "@/components/add-connection-dialog";
import { AppShell } from "@/components/app-shell";
import { EmptyState } from "@/components/empty-state";
import { ProviderIcon } from "@/components/provider-icon";
import { ConnectionStatusBadge, TransferStatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { tryGetProvider } from "@/core/registry";
import { formatBytes, formatDateTime } from "@/lib/format";
import { activityQuery, connectionsQuery, filesQuery, transfersQuery } from "@/lib/queries";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — ODrive" },
      {
        name: "description",
        content: "Storage across every connected provider, live transfers and recent activity.",
      },
      { property: "og:title", content: "Dashboard — ODrive" },
      {
        property: "og:description",
        content: "Storage across every connected provider, live transfers and recent activity.",
      },
    ],
  }),
  component: DashboardPage,
});

function DashboardPage() {
  const connections = useQuery(connectionsQuery);
  const transfers = useQuery(transfersQuery);
  const activity = useQuery(activityQuery);
  const connected = (connections.data ?? []).filter((c) => c.status === "connected");
  const files = useQuery(filesQuery(connected.map((c) => c.id)));

  const usedBytes = connected.reduce((sum, c) => sum + c.quotaUsedBytes, 0);
  const totalBytes = connected.reduce((sum, c) => sum + c.quotaTotalBytes, 0);
  const activeTransfers = (transfers.data ?? []).filter(
    (t) => t.status === "running" || t.status === "queued",
  );
  const fileCount = (files.data ?? []).filter((f) => !f.trashed && f.kind === "file").length;

  const stats = [
    { label: "Connections", value: String((connections.data ?? []).length), icon: Plug },
    { label: "Providers live", value: `${new Set(connected.map((c) => c.providerId)).size}/5`, icon: Waypoints },
    { label: "Files indexed", value: String(fileCount), icon: Files },
    { label: "Storage used", value: formatBytes(usedBytes), icon: HardDrive },
  ];

  return (
    <AppShell
      title="Dashboard"
      description="Everything across your connected providers, in one place."
      actions={<AddConnectionDialog />}
    >
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => (
          <div key={stat.label} className="panel p-5">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">{stat.label}</p>
              <stat.icon className="size-4 text-muted-foreground" strokeWidth={1.8} />
            </div>
            <p className="mt-3 font-display text-2xl font-semibold">{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <div className="panel p-5 lg:col-span-2">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-sm font-semibold">Capacity by connection</h2>
            <Button asChild variant="ghost" size="sm">
              <Link to="/connections">
                Manage
                <ArrowRight className="size-4" />
              </Link>
            </Button>
          </div>
          {connections.isLoading ? (
            <p className="mt-6 text-sm text-muted-foreground">Loading connections…</p>
          ) : (connections.data ?? []).length === 0 ? (
            <EmptyState
              className="mt-5"
              title="No connections yet"
              description="Add your first provider account to start unifying storage."
              action={<AddConnectionDialog triggerLabel="Add your first connection" />}
            />
          ) : (
            <ul className="mt-5 space-y-4">
              {(connections.data ?? []).map((connection) => {
                const descriptor = tryGetProvider(connection.providerId)?.descriptor;
                const pct = connection.quotaTotalBytes
                  ? Math.round((connection.quotaUsedBytes / connection.quotaTotalBytes) * 100)
                  : 0;
                return (
                  <li key={connection.id} className="flex items-center gap-4">
                    <ProviderIcon
                      icon={descriptor?.icon ?? "Cloud"}
                      accent={descriptor?.accent ?? "provider-r2"}
                      size="sm"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-3">
                        <p className="truncate text-sm font-medium">{connection.name}</p>
                        <p className="font-mono text-xs text-muted-foreground">
                          {formatBytes(connection.quotaUsedBytes)}
                          {connection.quotaTotalBytes
                            ? ` / ${formatBytes(connection.quotaTotalBytes)}`
                            : " / unlimited"}
                        </p>
                      </div>
                      <Progress value={pct} className="mt-2 h-1.5" />
                    </div>
                    <ConnectionStatusBadge status={connection.status} />
                  </li>
                );
              })}
            </ul>
          )}
          {totalBytes ? (
            <p className="mt-5 font-mono text-xs text-muted-foreground">
              pooled: {formatBytes(usedBytes)} of {formatBytes(totalBytes)}
            </p>
          ) : null}
        </div>

        <div className="panel p-5">
          <h2 className="font-display text-sm font-semibold">Active transfers</h2>
          {activeTransfers.length === 0 ? (
            <p className="mt-5 text-sm text-muted-foreground">Queue is empty.</p>
          ) : (
            <ul className="mt-5 space-y-4">
              {activeTransfers.map((job) => (
                <li key={job.id}>
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-medium">{job.fileName}</p>
                    <TransferStatusBadge status={job.status} />
                  </div>
                  <Progress value={job.progress} className="mt-2 h-1.5" />
                  <p className="mt-1 font-mono text-[11px] text-muted-foreground">
                    {job.direction} · {formatBytes(job.sizeBytes)}
                  </p>
                </li>
              ))}
            </ul>
          )}
          <Button asChild variant="outline" size="sm" className="mt-6 w-full">
            <Link to="/transfers">Open transfer queue</Link>
          </Button>
        </div>
      </div>

      <div className="panel mt-4 p-5">
        <h2 className="font-display text-sm font-semibold">Recent activity</h2>
        <ul className="mt-4 divide-y divide-border">
          {(activity.data ?? []).map((log) => (
            <li key={log.id} className="flex flex-wrap items-center gap-2 py-2.5 text-sm">
              <span className="font-mono text-xs text-primary">{log.action}</span>
              <span className="text-muted-foreground">{log.target}</span>
              <span className="ml-auto text-xs text-muted-foreground">
                {formatDateTime(log.createdAt)}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </AppShell>
  );
}
