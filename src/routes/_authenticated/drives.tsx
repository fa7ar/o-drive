import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { AddDriveDialog } from "@/components/add-drive-dialog";
import { AppShell } from "@/components/app-shell";
import { EmptyState } from "@/components/empty-state";
import { ProviderIcon } from "@/components/provider-icon";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  deleteDrive,
  healthCheckDrive,
  setDefaultDrive,
  syncDrive,
  updateDrive,
} from "@/core/drives";
import { formatBytes, formatDateTime } from "@/lib/format";
import { drivesQuery } from "@/lib/queries";

export const Route = createFileRoute("/_authenticated/drives")({
  head: () => ({
    meta: [
      { title: "Drives — ODrive" },
      {
        name: "description",
        content:
          "Every storage account you connected, as a drive: usage, health, last sync and one-click actions.",
      },
      { property: "og:title", content: "Drives — ODrive" },
      { property: "og:description", content: "Manage all of your storage drives in one workspace." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Drives,
});

const STATUS_TONE: Record<string, string> = {
  active: "border-success/30 bg-success/10 text-success",
  paused: "border-warning/30 bg-warning/15 text-warning-foreground",
  error: "border-destructive/30 bg-destructive/10 text-destructive",
};

function Drives() {
  const drives = useQuery(drivesQuery);
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");

  const refresh = () => queryClient.invalidateQueries();

  const rename = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => updateDrive(id, { name }),
    onSuccess: () => {
      refresh();
      setEditing(null);
      toast.success("Drive renamed");
    },
  });

  const runSync = useMutation({
    mutationFn: (id: string) => syncDrive(id),
    onSuccess: (job) => {
      refresh();
      toast.success(`Sync ${job.status}`, {
        description: `${job.scanned} scanned · ${job.added + job.updated + job.removed} changes`,
      });
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

  const makeDefault = useMutation({
    mutationFn: (id: string) => setDefaultDrive(id),
    onSuccess: () => refresh(),
  });

  const pause = useMutation({
    mutationFn: ({ id, paused }: { id: string; paused: boolean }) =>
      updateDrive(id, { status: paused ? "paused" : "active" }),
    onSuccess: () => refresh(),
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteDrive(id),
    onSuccess: () => {
      refresh();
      toast.success("Drive deleted");
    },
  });

  const list = drives.data ?? [];

  return (
    <AppShell
      title="Drives"
      description="One drive per authenticated account. Add the same provider as many times as you need."
      actions={<AddDriveDialog />}
    >
      {!list.length ? (
        <EmptyState
          title="No drives yet"
          description="Add your first drive to start browsing and transferring files."
          action={<AddDriveDialog triggerLabel="Add your first drive" />}
        />
      ) : (
        <div className="grid gap-3 xl:grid-cols-2">
          {list.map(({ drive, connection, descriptor }) => {
            const used = connection.quotaUsedBytes;
            const total = connection.quotaTotalBytes;
            return (
              <section key={drive.id} className="panel flex flex-col gap-3 p-5">
                <div className="flex items-start gap-3">
                  <ProviderIcon
                    icon={descriptor?.icon ?? "HardDrive"}
                    accent={descriptor?.accent ?? "primary"}
                  />
                  <div className="min-w-0 flex-1">
                    {editing === drive.id ? (
                      <form
                        className="flex gap-2"
                        onSubmit={(event) => {
                          event.preventDefault();
                          rename.mutate({ id: drive.id, name: draft });
                        }}
                      >
                        <Input
                          value={draft}
                          onChange={(event) => setDraft(event.target.value)}
                          className="h-8 max-w-56"
                          aria-label="Drive name"
                        />
                        <Button size="sm" type="submit">
                          Save
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>
                          Cancel
                        </Button>
                      </form>
                    ) : (
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="truncate font-display text-sm font-semibold">{drive.name}</h2>
                        {drive.isDefault ? (
                          <Badge variant="outline" className="text-[11px]">
                            default
                          </Badge>
                        ) : null}
                        <Badge variant="outline" className={STATUS_TONE[drive.status]}>
                          {drive.status}
                        </Badge>
                      </div>
                    )}
                    <p className="mt-1 truncate text-sm text-muted-foreground">
                      {descriptor?.name ?? connection.providerId} · {connection.accountLabel}
                    </p>
                    {drive.description ? (
                      <p className="mt-1 text-xs text-muted-foreground">{drive.description}</p>
                    ) : null}
                  </div>
                </div>

                <div>
                  <Progress value={total ? (used / total) * 100 : 0} className="h-1.5" />
                  <p className="mt-1 font-mono text-[11px] text-muted-foreground">
                    {formatBytes(used)} {total ? `of ${formatBytes(total)}` : "used (unmetered)"}
                  </p>
                </div>

                <p className="font-mono text-[11px] text-muted-foreground">
                  sync: {drive.lastSyncAt ? formatDateTime(drive.lastSyncAt) : "never"} · health:{" "}
                  {drive.lastHealthCheckAt ? formatDateTime(drive.lastHealthCheckAt) : "never"}
                  {drive.rootReference ? ` · root: ${drive.rootReference}` : ""}
                </p>

                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="secondary" asChild>
                    <Link to="/explorer">Open</Link>
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setEditing(drive.id);
                      setDraft(drive.name);
                    }}
                  >
                    Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => runSync.mutate(drive.id)}
                    disabled={runSync.isPending}
                  >
                    Sync
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => check.mutate(drive.id)}>
                    Health check
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
                  {drive.isDefault ? null : (
                    <Button size="sm" variant="ghost" onClick={() => makeDefault.mutate(drive.id)}>
                      Make default
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive"
                    onClick={() => remove.mutate(drive.id)}
                  >
                    Delete
                  </Button>
                </div>
              </section>
            );
          })}
        </div>
      )}
    </AppShell>
  );
}
