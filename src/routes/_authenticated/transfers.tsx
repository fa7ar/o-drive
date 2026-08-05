import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowDownToLine, ArrowUpFromLine, RotateCcw, Upload, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/app-shell";
import { EmptyState } from "@/components/empty-state";
import { TransferStatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { queueTransfer, removeTransfer, updateTransfer } from "@/core/services";
import type { TransferJob } from "@/core/types";
import { formatBytes, formatDateTime } from "@/lib/format";
import { connectionsQuery, transfersQuery } from "@/lib/queries";

export const Route = createFileRoute("/_authenticated/transfers")({
  head: () => ({
    meta: [
      { title: "Transfers — ODrive" },
      {
        name: "description",
        content: "Upload and download queues with retry, cancel and completed or failed history.",
      },
      { property: "og:title", content: "Transfers — ODrive" },
      {
        property: "og:description",
        content: "Upload and download queues with retry, cancel and full job history.",
      },
    ],
  }),
  component: TransfersPage,
});

type Filter = "all" | "upload" | "download";

function TransfersPage() {
  const transfers = useQuery(transfersQuery);
  const connections = useQuery(connectionsQuery);
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<Filter>("all");
  const [open, setOpen] = useState(false);
  const [fileName, setFileName] = useState("");
  const [sizeMb, setSizeMb] = useState("12");
  const [connectionId, setConnectionId] = useState("");

  const invalidate = () => queryClient.invalidateQueries();
  const connected = (connections.data ?? []).filter((c) => c.status === "connected");

  const patchMutation = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<TransferJob> }) =>
      updateTransfer(id, patch),
    onSuccess: invalidate,
  });

  const removeMutation = useMutation({
    mutationFn: (id: string) => removeTransfer(id),
    onSuccess: () => {
      invalidate();
      toast.success("Job removed from queue");
    },
  });

  const queueMutation = useMutation({
    mutationFn: () =>
      queueTransfer({
        connectionId: connectionId || connected[0]?.id || "",
        fileName: fileName.trim(),
        direction: "upload",
        sizeBytes: Math.max(1, Number(sizeMb) || 1) * 1_000_000,
      }),
    onSuccess: (job) => {
      invalidate();
      setOpen(false);
      setFileName("");
      toast.success("Upload queued", { description: job.fileName });
    },
  });

  const jobs = (transfers.data ?? []).filter((job) =>
    filter === "all" ? true : job.direction === filter,
  );
  const active = jobs.filter((j) => j.status === "queued" || j.status === "running");
  const history = jobs.filter((j) => j.status !== "queued" && j.status !== "running");

  const connectionName = (id: string) =>
    (connections.data ?? []).find((c) => c.id === id)?.name ?? "unknown connection";

  const jobRow = (job: TransferJob) => (
    <div key={job.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
      {job.direction === "upload" ? (
        <ArrowUpFromLine className="size-4 shrink-0 text-primary" strokeWidth={1.8} />
      ) : (
        <ArrowDownToLine className="size-4 shrink-0 text-muted-foreground" strokeWidth={1.8} />
      )}
      <div className="min-w-40 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-medium">{job.fileName}</p>
          <TransferStatusBadge status={job.status} />
        </div>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {connectionName(job.connectionId)} · {formatBytes(job.sizeBytes)} ·{" "}
          {formatDateTime(job.createdAt)}
        </p>
        {job.status === "running" || job.status === "failed" ? (
          <Progress value={job.progress} className="mt-2 h-1.5" />
        ) : null}
        {job.error ? <p className="mt-1 text-xs text-destructive">{job.error}</p> : null}
      </div>
      <div className="flex gap-1">
        {job.status === "failed" || job.status === "cancelled" ? (
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              patchMutation.mutate({
                id: job.id,
                patch: { status: "queued", progress: 0, error: "" },
              })
            }
          >
            <RotateCcw className="size-3.5" />
            Retry
          </Button>
        ) : null}
        {job.status === "queued" || job.status === "running" ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => patchMutation.mutate({ id: job.id, patch: { status: "cancelled" } })}
          >
            <X className="size-3.5" />
            Cancel
          </Button>
        ) : (
          <Button variant="ghost" size="sm" onClick={() => removeMutation.mutate(job.id)}>
            Clear
          </Button>
        )}
      </div>
    </div>
  );

  return (
    <AppShell
      title="Transfers"
      description="Queued, running and completed jobs across every provider adapter."
      actions={
        <>
          <Tabs value={filter} onValueChange={(value) => setFilter(value as Filter)}>
            <TabsList>
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="upload">Uploads</TabsTrigger>
              <TabsTrigger value="download">Downloads</TabsTrigger>
            </TabsList>
          </Tabs>
          <Button onClick={() => setOpen(true)} disabled={connected.length === 0}>
            <Upload className="size-4" />
            Queue upload
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <section className="panel">
          <header className="border-b border-border px-4 py-3">
            <h2 className="font-display text-sm font-semibold">Active queue</h2>
          </header>
          {active.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">
              Nothing in the queue right now.
            </p>
          ) : (
            <div className="divide-y divide-border">{active.map(jobRow)}</div>
          )}
        </section>

        <section className="panel">
          <header className="border-b border-border px-4 py-3">
            <h2 className="font-display text-sm font-semibold">History</h2>
          </header>
          {history.length === 0 ? (
            <EmptyState
              className="m-4 border-0 bg-transparent py-8"
              title="No completed or failed jobs yet"
            />
          ) : (
            <div className="divide-y divide-border">{history.map(jobRow)}</div>
          )}
        </section>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Queue an upload</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="file-name">File name</Label>
              <Input
                id="file-name"
                value={fileName}
                onChange={(event) => setFileName(event.target.value)}
                placeholder="release-notes.pdf"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="size">Size (MB)</Label>
              <Input
                id="size"
                type="number"
                min={1}
                value={sizeMb}
                onChange={(event) => setSizeMb(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="destination">Destination</Label>
              <Select
                value={connectionId || connected[0]?.id || ""}
                onValueChange={setConnectionId}
              >

                <SelectTrigger id="destination">
                  <SelectValue placeholder="Choose a connection" />
                </SelectTrigger>
                <SelectContent>
                  {connected.map((connection) => (
                    <SelectItem key={connection.id} value={connection.id}>
                      {connection.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => queueMutation.mutate()}
              disabled={!fileName.trim() || queueMutation.isPending}
            >
              Queue upload
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
