import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import { AppShell } from "@/components/app-shell";
import { metricsQuery } from "@/lib/queries";
import { formatBytes } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/home")({
  head: () => ({
    meta: [
      { title: "Dashboard — ODrive" },
      {
        name: "description",
        content: "Overview of your ODrive workspace: storage usage, recent activity, and quick access to key features.",
      },
      { property: "og:title", content: "Dashboard — ODrive" },
      {
        property: "og:description",
        content: "Workspace overview and key metrics.",
      },
    ],
  }),
  component: HomePage,
});

function HomePage() {
  const metrics = useQuery(metricsQuery);
  const data = metrics.data;

  const storagePercent =
    data && data.storageTotalBytes > 0
      ? Math.round((data.storageUsedBytes / data.storageTotalBytes) * 100)
      : 0;

  return (
    <AppShell
      title="Dashboard"
      description="Overview of your ODrive workspace, storage usage, and quick insights."
    >
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="panel p-4">
          <p className="text-xs tracking-wide text-muted-foreground uppercase">Storage Used</p>
          <p className="mt-2 text-2xl font-semibold">{formatBytes(data?.storageUsedBytes ?? 0)}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {storagePercent}% of {formatBytes(data?.storageTotalBytes ?? 0)}
          </p>
        </div>
        <div className="panel p-4">
          <p className="text-xs tracking-wide text-muted-foreground uppercase">Connections</p>
          <p className="mt-2 text-2xl font-semibold">{data?.connectionsActive ?? 0}</p>
          <p className="mt-1 text-xs text-muted-foreground">Active providers</p>
        </div>
        <div className="panel p-4">
          <p className="text-xs tracking-wide text-muted-foreground uppercase">Transfers</p>
          <p className="mt-2 text-2xl font-semibold">{data?.jobsRunning ?? 0}</p>
          <p className="mt-1 text-xs text-muted-foreground">{data?.jobsQueued ?? 0} queued</p>
        </div>
        <div className="panel p-4">
          <p className="text-xs tracking-wide text-muted-foreground uppercase">Automations</p>
          <p className="mt-2 text-2xl font-semibold">—</p>
          <p className="mt-1 text-xs text-muted-foreground">Configure in Settings</p>
        </div>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <section className="panel p-5">
          <h2 className="font-display text-sm font-semibold">Welcome to ODrive</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            ODrive is your unified workspace for managing storage across multiple providers. Connect drives, browse files, run transfers, and automate workflows without vendor lock-in.
          </p>
          <div className="mt-4 space-y-2 text-sm text-muted-foreground">
            <p>✓ Connect unlimited storage accounts (Google Drive, OneDrive, S3, R2, and more)</p>
            <p>✓ Browse and search files from every provider in one place</p>
            <p>✓ Transfer files between providers seamlessly</p>
            <p>✓ Create public share links and set expiration dates</p>
            <p>✓ Automate repetitive tasks with rules and automations</p>
          </div>
        </section>

        <section className="panel p-5">
          <h2 className="font-display text-sm font-semibold">Quick Start</h2>
          <ul className="mt-4 space-y-3 text-sm">
            <li className="flex items-start gap-3">
              <span className="shrink-0 text-primary">1.</span>
              <span className="text-muted-foreground">
                <strong>Add a drive</strong> in the Files menu to connect your first storage account
              </span>
            </li>
            <li className="flex items-start gap-3">
              <span className="shrink-0 text-primary">2.</span>
              <span className="text-muted-foreground">
                <strong>Explore</strong> files and browse your storage across all connected accounts
              </span>
            </li>
            <li className="flex items-start gap-3">
              <span className="shrink-0 text-primary">3.</span>
              <span className="text-muted-foreground">
                <strong>Create transfers</strong> to move files between providers
              </span>
            </li>
            <li className="flex items-start gap-3">
              <span className="shrink-0 text-primary">4.</span>
              <span className="text-muted-foreground">
                <strong>Set up automations</strong> to run rules on schedules or events
              </span>
            </li>
          </ul>
        </section>
      </div>
    </AppShell>
  );
}
