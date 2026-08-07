import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import { AdminNav } from "@/components/admin-nav";
import { AppShell } from "@/components/app-shell";
import { ConnectionStatusBadge } from "@/components/status-badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatBytes, formatDateTime } from "@/lib/format";
import { connectionsQuery, syncHistoryQuery, syncJobsQuery } from "@/lib/queries";

export const Route = createFileRoute("/_authenticated/admin/connections")({
  head: () => ({
    meta: [
      { title: "Connections — ODrive admin" },
      { name: "description", content: "Every linked storage account with quota, status and sync history." },
      { property: "og:title", content: "Connections — ODrive admin" },
      { property: "og:description", content: "Linked accounts, quota usage and sync history." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdminConnections,
});

function AdminConnections() {
  const connections = useQuery(connectionsQuery);
  const syncJobs = useQuery(syncJobsQuery);
  const history = useQuery(syncHistoryQuery);

  return (
    <AppShell title="Connections" description="Account inventory and metadata sync state.">
      <AdminNav />
      <section className="panel p-5">
        <h2 className="font-display text-sm font-semibold">Linked accounts</h2>
        <Table className="mt-3">
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Provider</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Used</TableHead>
              <TableHead>Quota</TableHead>
              <TableHead>Linked</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(connections.data ?? []).map((connection) => (
              <TableRow key={connection.id}>
                <TableCell>{connection.name}</TableCell>
                <TableCell className="font-mono text-xs">{connection.providerId}</TableCell>
                <TableCell>
                  <ConnectionStatusBadge status={connection.status} />
                </TableCell>
                <TableCell className="text-xs">{formatBytes(connection.quotaUsedBytes)}</TableCell>
                <TableCell className="text-xs">{formatBytes(connection.quotaTotalBytes)}</TableCell>
                <TableCell className="text-xs">
                  {formatDateTime(connection.createdAt)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </section>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <section className="panel p-5">
          <h2 className="font-display text-sm font-semibold">Sync jobs</h2>
          <ul className="mt-3 space-y-3 text-sm">
            {(syncJobs.data ?? []).map((job) => (
              <li key={job.id} className="flex justify-between gap-3">
                <span className="truncate font-mono text-xs">{job.connectionId}</span>
                <span className="text-xs text-muted-foreground">
                  {job.status} · +{job.added} ~{job.updated} !{job.conflicts.length}
                </span>
              </li>
            ))}
            {!syncJobs.data?.length ? (
              <li className="text-muted-foreground">No sync jobs yet.</li>
            ) : null}
          </ul>
        </section>
        <section className="panel p-5">
          <h2 className="font-display text-sm font-semibold">Sync history</h2>
          <ul className="mt-3 space-y-3 text-sm">
            {(history.data ?? []).map((entry) => (
              <li key={entry.id} className="flex justify-between gap-3">
                <span className="truncate">{formatDateTime(entry.createdAt)}</span>
                <span className="text-xs text-muted-foreground">
                  {entry.changes} changes · {entry.conflicts} conflicts
                </span>
              </li>
            ))}
            {!history.data?.length ? (
              <li className="text-muted-foreground">No history recorded.</li>
            ) : null}
          </ul>
        </section>
      </div>
    </AppShell>
  );
}
