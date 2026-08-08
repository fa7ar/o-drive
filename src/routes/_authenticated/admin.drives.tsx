import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { AdminNav } from "@/components/admin-nav";
import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { healthCheckDrive, syncDrive, updateDrive } from "@/core/drives";
import { formatBytes, formatDateTime } from "@/lib/format";
import { drivesQuery, syncHistoryQuery } from "@/lib/queries";

export const Route = createFileRoute("/_authenticated/admin/drives")({
  head: () => ({
    meta: [
      { title: "Drives — ODrive admin" },
      {
        name: "description",
        content: "All workspace drives with backing connection, status, sync history and actions.",
      },
      { property: "og:title", content: "Drives — ODrive admin" },
      { property: "og:description", content: "Drive inventory, sync history and health." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdminDrives,
});

function AdminDrives() {
  const drives = useQuery(drivesQuery);
  const history = useQuery(syncHistoryQuery);
  const queryClient = useQueryClient();
  const refresh = () => queryClient.invalidateQueries();

  const runSync = useMutation({
    mutationFn: (id: string) => syncDrive(id),
    onSuccess: () => {
      refresh();
      toast.success("Sync finished");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const check = useMutation({
    mutationFn: (id: string) => healthCheckDrive(id),
    onSuccess: (status) => {
      refresh();
      toast.success(`Health check: ${status}`);
    },
  });

  const pause = useMutation({
    mutationFn: ({ id, paused }: { id: string; paused: boolean }) =>
      updateDrive(id, { status: paused ? "paused" : "active" }),
    onSuccess: () => refresh(),
  });

  return (
    <AppShell title="Drives" description="Drive → Connection → Provider, for every workspace drive.">
      <AdminNav />

      <section className="panel overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-border text-left text-xs text-muted-foreground">
            <tr>
              <th className="px-4 py-2 font-medium">Drive</th>
              <th className="px-4 py-2 font-medium">Provider</th>
              <th className="px-4 py-2 font-medium">Account</th>
              <th className="px-4 py-2 font-medium">Status</th>
              <th className="px-4 py-2 font-medium">Usage</th>
              <th className="px-4 py-2 font-medium">Last sync</th>
              <th className="px-4 py-2 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {(drives.data ?? []).map(({ drive, connection, descriptor }) => (
              <tr key={drive.id}>
                <td className="px-4 py-2">
                  <span className="font-medium">{drive.name}</span>
                  {drive.isDefault ? (
                    <Badge variant="outline" className="ml-2 text-[11px]">
                      default
                    </Badge>
                  ) : null}
                  <span className="block font-mono text-[11px] text-muted-foreground">
                    {drive.id}
                  </span>
                </td>
                <td className="px-4 py-2">{descriptor?.name ?? connection.providerId}</td>
                <td className="px-4 py-2 font-mono text-[11px]">{connection.accountLabel}</td>
                <td className="px-4 py-2">
                  <Badge variant="outline" className="capitalize">
                    {drive.status}
                  </Badge>
                </td>
                <td className="px-4 py-2 font-mono text-[11px]">
                  {formatBytes(connection.quotaUsedBytes)}
                  {connection.quotaTotalBytes
                    ? ` / ${formatBytes(connection.quotaTotalBytes)}`
                    : ""}
                </td>
                <td className="px-4 py-2 font-mono text-[11px] text-muted-foreground">
                  {drive.lastSyncAt ? formatDateTime(drive.lastSyncAt) : "never"}
                </td>
                <td className="px-4 py-2">
                  <div className="flex gap-1">
                    <Button size="sm" variant="ghost" onClick={() => runSync.mutate(drive.id)}>
                      Sync
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => check.mutate(drive.id)}>
                      Test
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() =>
                        pause.mutate({ id: drive.id, paused: drive.status !== "paused" })
                      }
                    >
                      {drive.status === "paused" ? "Resume" : "Pause"}
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="panel mt-4 p-5">
        <h2 className="font-display text-sm font-semibold">Sync history</h2>
        <ul className="mt-3 space-y-2 text-sm">
          {(history.data ?? []).map((entry) => (
            <li key={entry.id} className="flex justify-between gap-3">
              <span className="font-mono text-[11px]">{entry.connectionId}</span>
              <span className="text-xs text-muted-foreground">
                {entry.changes} changes · {entry.conflicts} conflicts ·{" "}
                {formatDateTime(entry.createdAt)}
              </span>
            </li>
          ))}
          {!history.data?.length ? (
            <li className="text-muted-foreground">No sync runs recorded yet.</li>
          ) : null}
        </ul>
      </section>
    </AppShell>
  );
}
