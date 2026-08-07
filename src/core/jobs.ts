import type { BackgroundJob, JobKind, JobLogEntry, JobPriority, LogSeverity } from "./types";
import { useContainer } from "./container";
import { publish } from "./event-bus";
import { log } from "./logs";

/**
 * Job Queue. The interface mirrors Cloudflare Queues / BullMQ (send, consume,
 * retry, pause, resume, cancel) so the in-process worker can be swapped for a
 * real queue binding without touching callers. Failing jobs land in the
 * dead-letter queue after `maxAttempts`.
 */

export type JobHandler = (job: BackgroundJob, ctx: JobContext) => Promise<void>;

export interface JobContext {
  progress(done: number, total?: number): Promise<void>;
  note(message: string, severity?: LogSeverity): Promise<void>;
  cancelled(): Promise<boolean>;
}

const handlers = new Map<JobKind, JobHandler>();
const PRIORITY_ORDER: Record<JobPriority, number> = { high: 0, medium: 1, low: 2 };

let paused = false;

export function registerJobHandler(kind: JobKind, handler: JobHandler): void {
  handlers.set(kind, handler);
}

export async function enqueue(input: {
  kind: JobKind;
  payload: Record<string, unknown>;
  priority?: JobPriority;
  label?: string;
  providerId?: string;
  connectionId?: string;
  bytesTotal?: number;
  maxAttempts?: number;
}): Promise<BackgroundJob> {
  const { jobs } = useContainer();
  const job = await jobs.enqueue({ priority: "medium", maxAttempts: 3, ...input });
  await log({
    category: "queue",
    severity: "info",
    message: `Job ${job.kind} enqueued (${job.priority})`,
    ...(job.providerId ? { providerId: job.providerId } : {}),
  });
  publish({ type: "job.updated", jobId: job.id });
  if (!paused) void consume(job.id);
  return job;
}

/** Backwards-compatible helper used by earlier modules. */
export async function send(kind: JobKind, payload: Record<string, unknown>): Promise<BackgroundJob> {
  return enqueue({ kind, payload });
}

function context(jobId: string): JobContext {
  const { jobs, jobLogs } = useContainer();
  const startedAt = Date.now();
  return {
    async progress(done, total) {
      const job = await jobs.get(jobId);
      const bytesTotal = total ?? job?.bytesTotal ?? 0;
      const elapsed = Math.max(1, (Date.now() - startedAt) / 1000);
      const speed = done / elapsed;
      await jobs.update(jobId, {
        bytesDone: done,
        ...(bytesTotal ? { bytesTotal } : {}),
        progress: bytesTotal ? Math.min(100, Math.round((done / bytesTotal) * 100)) : 0,
        speedBytesPerSecond: Math.round(speed),
        etaSeconds: speed > 0 && bytesTotal ? Math.round((bytesTotal - done) / speed) : 0,
      });
      publish({ type: "job.updated", jobId });
    },
    async note(message, severity = "info") {
      await jobLogs.append({ jobId, message, severity });
    },
    async cancelled() {
      const job = await jobs.get(jobId);
      return job?.status === "cancelled";
    },
  };
}

async function consume(jobId: string): Promise<void> {
  const { jobs } = useContainer();
  const queued = await jobs.get(jobId);
  if (!queued || queued.status === "cancelled" || queued.status === "paused") return;

  const handler = handlers.get(queued.kind);
  if (!handler) {
    await jobs.update(jobId, { status: "failed", error: "No handler registered", deadLettered: true });
    await log({ category: "queue", severity: "error", message: `No handler for ${queued.kind}` });
    return;
  }

  const attempts = queued.attempts + 1;
  await jobs.update(jobId, { status: "running", attempts });
  publish({ type: "job.updated", jobId });
  const ctx = context(jobId);

  try {
    await handler(queued, ctx);
    if (await ctx.cancelled()) return;
    await jobs.update(jobId, {
      status: "done",
      progress: 100,
      etaSeconds: 0,
      finishedAt: new Date().toISOString(),
    });
    await ctx.note("Job completed");
    publish({ type: "job.updated", jobId });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Job failed";
    await ctx.note(`Attempt ${attempts} failed — ${message}`, "warning");
    if (attempts < queued.maxAttempts) {
      const backoff = 2 ** attempts * 1000;
      await jobs.update(jobId, { status: "queued", error: message });
      publish({ type: "job.updated", jobId });
      setTimeout(() => void consume(jobId), backoff);
      return;
    }
    await jobs.update(jobId, {
      status: "failed",
      error: message,
      deadLettered: true,
      finishedAt: new Date().toISOString(),
    });
    await ctx.note("Retries exhausted — moved to dead-letter queue", "error");
    await log({ category: "queue", severity: "error", message: `Job ${queued.kind} dead-lettered: ${message}` });
    publish({ type: "job.updated", jobId });
  }
}

export async function retry(jobId: string): Promise<void> {
  await useContainer().jobs.update(jobId, {
    status: "queued",
    attempts: 0,
    deadLettered: false,
    error: undefined as unknown as string,
  });
  publish({ type: "job.updated", jobId });
  await consume(jobId);
}

export async function cancel(jobId: string): Promise<void> {
  await useContainer().jobs.update(jobId, {
    status: "cancelled",
    finishedAt: new Date().toISOString(),
  });
  await log({ category: "queue", severity: "warning", message: `Job ${jobId} cancelled` });
  publish({ type: "job.updated", jobId });
}

export async function pauseQueue(): Promise<void> {
  paused = true;
  await log({ category: "queue", severity: "warning", message: "Queue paused by an administrator" });
}

export async function resumeQueue(): Promise<void> {
  paused = false;
  await log({ category: "queue", severity: "info", message: "Queue resumed" });
  const { jobs } = useContainer();
  const pending = (await jobs.list(200))
    .filter((job) => job.status === "queued")
    .sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]);
  for (const job of pending) void consume(job.id);
}

export const isQueuePaused = (): boolean => paused;

export async function listJobs(limit = 100): Promise<BackgroundJob[]> {
  const jobs = await useContainer().jobs.list(limit);
  return [...jobs].sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]);
}

export async function jobLog(jobId: string): Promise<JobLogEntry[]> {
  return useContainer().jobLogs.list(jobId);
}
