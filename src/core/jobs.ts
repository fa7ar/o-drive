import type { BackgroundJob, JobKind } from "./types";
import { useContainer } from "./container";

/**
 * Background queue. The interface mirrors Cloudflare Queues (send / consume)
 * so the in-process worker can be replaced by a real queue binding without
 * touching callers.
 */

export type JobHandler = (job: BackgroundJob) => Promise<void>;

const handlers = new Map<JobKind, JobHandler>();

export function registerJobHandler(kind: JobKind, handler: JobHandler): void {
  handlers.set(kind, handler);
}

export async function send(kind: JobKind, payload: Record<string, unknown>): Promise<BackgroundJob> {
  const { jobs } = useContainer();
  const job = await jobs.enqueue({ kind, payload });
  void consume(job.id);
  return job;
}

async function consume(jobId: string): Promise<void> {
  const { jobs } = useContainer();
  const queued = (await jobs.list(200)).find((job) => job.id === jobId);
  if (!queued) return;
  const handler = handlers.get(queued.kind);
  if (!handler) {
    await jobs.update(jobId, { status: "failed", error: "No handler registered" });
    return;
  }
  await jobs.update(jobId, { status: "running", attempts: queued.attempts + 1 });
  try {
    await handler(queued);
    await jobs.update(jobId, { status: "done", finishedAt: new Date().toISOString() });
  } catch (error) {
    await jobs.update(jobId, {
      status: "failed",
      error: error instanceof Error ? error.message : "Job failed",
      finishedAt: new Date().toISOString(),
    });
  }
}

export async function retry(jobId: string): Promise<void> {
  await useContainer().jobs.update(jobId, { status: "queued", error: undefined });
  await consume(jobId);
}

export async function listJobs(limit = 25): Promise<BackgroundJob[]> {
  return useContainer().jobs.list(limit);
}
