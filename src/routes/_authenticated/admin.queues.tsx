import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { AdminNav } from "@/components/admin-nav";
import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cancel, isQueuePaused, pauseQueue, resumeQueue, retry } from "@/core/jobs";
import { formatBytes } from "@/lib/format";
import { jobsQuery } from "@/lib/queries";

export const Route = createFileRoute("/_authenticated/admin/queues")({
  head: () => ({
    meta: [
      { title: "Queues — ODrive admin" },
      { name: "description", content: "Job queue depth, retries, dead-letter queue and worker control." },
      { property: "og:title", content: "Queues — ODrive admin" },
      { property: "og:description", content: "Queue depth, retries and dead-letter inspection." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdminQueues,
});

function AdminQueues() {
  const jobs = useQuery(jobsQuery);
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["jobs"] });

  const action = useMutation({
    mutationFn: async (input: { kind: "retry" | "cancel" | "pause" | "resume"; jobId?: string }) => {
      if (input.kind === "retry" && input.jobId) return retry(input.jobId);
      if (input.kind === "cancel" && input.jobId) return cancel(input.jobId);
      return input.kind === "pause" ? pauseQueue() : resumeQueue();
    },
    onSuccess: () => {
      invalidate();
      toast.success("Queue updated");
    },
  });

  const dead = (jobs.data ?? []).filter((job) => job.deadLettered);

  return (
    <AppShell
      title="Queues"
      description="Priority scheduling, exponential backoff, dead-letter isolation."
      actions={
        <div className="flex gap-2">
          <Button size="sm" variant="secondary" onClick={() => action.mutate({ kind: "pause" })}>
            Pause
          </Button>
          <Button size="sm" onClick={() => action.mutate({ kind: "resume" })}>
            Resume
          </Button>
        </div>
      }
    >
      <AdminNav />
      <p className="mb-3 font-mono text-xs text-muted-foreground">
        worker state: {isQueuePaused() ? "paused" : "consuming"}
      </p>

      <section className="panel p-5">
        <h2 className="font-display text-sm font-semibold">Jobs</h2>
        <ul className="mt-4 space-y-4">
          {(jobs.data ?? []).map((job) => (
            <li key={job.id} className="border-t border-border pt-4 first:border-0 first:pt-0">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm">{job.label ?? job.kind}</p>
                  <p className="font-mono text-[11px] text-muted-foreground">
                    {job.kind} · {job.priority} · attempt {job.attempts}/{job.maxAttempts}
                    {job.bytesTotal ? ` · ${formatBytes(job.bytesDone)}/${formatBytes(job.bytesTotal)}` : ""}
                    {job.speedBytesPerSecond ? ` · ${formatBytes(job.speedBytesPerSecond)}/s` : ""}
                    {job.etaSeconds ? ` · eta ${job.etaSeconds}s` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="capitalize">
                    {job.status}
                  </Badge>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => action.mutate({ kind: "retry", jobId: job.id })}
                  >
                    Retry
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive"
                    onClick={() => action.mutate({ kind: "cancel", jobId: job.id })}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
              <Progress value={job.progress ?? 0} className="mt-2 h-1.5" />
              {job.error ? <p className="mt-1 text-xs text-destructive">{job.error}</p> : null}
            </li>
          ))}
          {!jobs.data?.length ? <li className="text-sm text-muted-foreground">Queue is empty.</li> : null}
        </ul>
      </section>

      <section className="panel mt-4 p-5">
        <h2 className="font-display text-sm font-semibold">Dead-letter queue ({dead.length})</h2>
        <ul className="mt-3 space-y-2 text-sm">
          {dead.map((job) => (
            <li key={job.id} className="flex justify-between gap-3">
              <span className="truncate">{job.label ?? job.kind}</span>
              <span className="text-xs text-destructive">{job.error}</span>
            </li>
          ))}
          {!dead.length ? <li className="text-muted-foreground">Nothing dead-lettered.</li> : null}
        </ul>
      </section>
    </AppShell>
  );
}
