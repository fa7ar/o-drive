import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  ArrowUpDown,
  Files,
  HardDrive,
  Link2,
  Plug,
  Zap,
} from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { formatBytes, formatDateTime } from "@/lib/format";
import {
  activityQuery,
  automationsQuery,
  connectionsQuery,
  drivesQuery,
  metricsQuery,
  sharesQuery,
  transfersQuery,
} from "@/lib/queries";

export const Route = createFileRoute("/_authenticated/home")({
  head: () => ({
    meta: [
      { title: "Dashboard — ODrive" },
      {
        name: "description",
        content:
          "Live overview of your ODrive workspace: storage, drives, transfers, shares, automations and provider health.",
      },
      { property: "og:title", content: "Dashboard — ODrive" },
      { property: "og:description", content: "Workspace overview and key metrics." },
    ],
  }),
  component: HomePage,
});

function HomePage() {
  const metrics = useQuery(metricsQuery);
  const connections = useQuery(connectionsQuery);
  const drives = useQuery(drivesQuery);
  const transfers = useQuery(transfersQuery);
  const shares = useQuery(sharesQuery);
  const automations = useQuery(automationsQuery);
  const activity = useQuery(activityQuery);

  const data = metrics.data;
  const connectionList = connections.data ?? [];
  const transferList = transfers.data ?? [];
  const activeTransfers = transferList.filter(
    (item) => item.status === "running" || item.status === "queued",
  );
  const shareList = (shares.data ?? []).map((view) => view.share);
  const activeShares = shareList.filter((share) => share.status === "active");
  const activeAutomations = (automations.data ?? []).filter(
    (automation) => automation.status === "active",
  );
  const healthy = connectionList.filter((item) => item.status === "connected").length;

  const storagePercent =
    data && data.storageTotalBytes > 0
      ? Math.round((data.storageUsedBytes / data.storageTotalBytes) * 100)
      : null;

  const stats = [
    {
      icon: HardDrive,
      label: "Storage used",
      value: formatBytes(data?.storageUsedBytes ?? 0),
      hint:
        storagePercent === null
          ? `${connectionList.length} connection${connectionList.length === 1 ? "" : "s"}`
          : `${storagePercent}% of ${formatBytes(data?.storageTotalBytes ?? 0)}`,
      to: "/drives",
    },
    {
      icon: Plug,
      label: "Drives & connections",
      value: `${(drives.data ?? []).length} / ${connectionList.length}`,
      hint: "drives / connections",
      to: "/connections",
    },
    {
      icon: ArrowUpDown,
      label: "Active transfers",
      value: String(activeTransfers.length),
      hint: `${data?.jobsFailed ?? 0} failed jobs`,
      to: "/transfers",
    },
    {
      icon: Link2,
      label: "Active shares",
      value: String(activeShares.length),
      hint: `${shareList.length} total`,
      to: "/shares",
    },
    {
      icon: Zap,
      label: "Automations",
      value: String(activeAutomations.length),
      hint: `${(automations.data ?? []).length} configured`,
      to: "/automations",
    },
    {
      icon: Files,
      label: "Provider health",
      value: `${healthy}/${connectionList.length}`,
      hint: data?.lastSyncAt ? `Last sync ${formatDateTime(data.lastSyncAt)}` : "No sync yet",
      to: "/connections",
    },
  ];

  return (
    <AppShell
      title="Dashboard"
      description="Live overview of your workspace — every number below comes from your actual drives, transfers and shares."
    >
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {stats.map((stat) => (
          <Link
            key={stat.label}
            to={stat.to}
            className="panel group flex items-start gap-3 p-4 transition-colors hover:border-primary/40"
          >
            <stat.icon className="mt-0.5 size-4 shrink-0 text-muted-foreground group-hover:text-primary" />
            <div className="min-w-0">
              <p className="text-xs tracking-wide text-muted-foreground uppercase">
                {stat.label}
              </p>
              <p className="mt-1 text-xl font-semibold">{stat.value}</p>
              <p className="mt-0.5 truncate text-xs text-muted-foreground">{stat.hint}</p>
            </div>
          </Link>
        ))}
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <section className="panel p-5">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-sm font-semibold">Recent transfers</h2>
            <Link
              to="/transfers"
              className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
            >
              View all <ArrowRight className="size-3" />
            </Link>
          </div>
          {transferList.length === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">
              No transfers yet. Move a file in the Explorer to see it here.
            </p>
          ) : (
            <ul className="mt-3 divide-y divide-border">
              {transferList.slice(0, 5).map((transfer) => (
                <li key={transfer.id} className="flex items-center gap-3 py-2.5 text-sm">
                  <span className="min-w-0 flex-1 truncate">{transfer.fileName}</span>
                  <span className="text-xs text-muted-foreground">
                    {formatBytes(transfer.sizeBytes)}
                  </span>
                  <Badge
                    variant={
                      transfer.status === "failed"
                        ? "destructive"
                        : transfer.status === "completed"
                          ? "default"
                          : "secondary"
                    }
                  >
                    {transfer.status}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="panel p-5">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-sm font-semibold">Recent activity</h2>
            <Link
              to="/activity"
              className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
            >
              View all <ArrowRight className="size-3" />
            </Link>
          </div>
          {(activity.data ?? []).length === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">
              Nothing recorded yet — connect a drive to get started.
            </p>
          ) : (
            <ul className="mt-3 divide-y divide-border">
              {(activity.data ?? []).slice(0, 5).map((entry) => (
                <li key={entry.id} className="flex items-center gap-3 py-2.5 text-sm">
                  <span className="min-w-0 flex-1 truncate">
                    <span className="font-medium">{entry.action}</span>{" "}
                    <span className="text-muted-foreground">{entry.target}</span>
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {formatDateTime(entry.createdAt)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </AppShell>
  );
}
