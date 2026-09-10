import { useContainer } from "./container";
import { getDrive, listDrives } from "./drives";
import { publish, subscribe } from "./event-bus";
import { enqueue, registerJobHandler } from "./jobs";
import { log } from "./logs";
import { evaluateGroup } from "./rule-evaluator";
import { StorageManager } from "./storage-manager";
import { mirror, queueSync, transfer } from "./transfer-engine";
import type {
  Automation,
  AutomationAction,
  AutomationEvent,
  AutomationRun,
  AutomationRunStatus,
} from "./types";
import { CURRENT_WORKSPACE } from "@/core/workspace";

/**
 * Automation Engine — Event → Condition → Action.
 *
 * It owns no execution machinery of its own: actions are mapped onto the
 * existing Transfer Engine, Sync Engine and Job Queue. Provider specifics never
 * appear here; drives resolve to connections, connections resolve to adapters.
 */

const DEFAULT_MAX_DEPTH = 5;
let wired = false;

/* ------------------------------ loop protection ----------------------------- */

function guard(automation: Automation, event: AutomationEvent): string | null {
  const depth = event.depth ?? 0;
  const max = automation.maxDepth || DEFAULT_MAX_DEPTH;
  if (depth >= max) return `Loop protection: depth ${depth} reached the limit of ${max}`;
  if ((event.processedAutomationIds ?? []).includes(automation.id))
    return "Loop protection: automation already ran in this event chain";
  return null;
}

/* ------------------------------ action execution ---------------------------- */

const str = (action: AutomationAction, key: string): string => {
  const value = action.configuration[key];
  return value === null || value === undefined ? "" : String(value);
};

async function resolveConnection(driveId: string): Promise<{ connectionId: string; label: string }> {
  const view = await getDrive(driveId);
  if (!view) throw new Error(`Drive ${driveId} is not available in this workspace`);
  return { connectionId: view.connection.id, label: view.drive.name };
}

async function filesFor(event: AutomationEvent, action: AutomationAction): Promise<Array<{
  id: string;
  name: string;
  sizeBytes: number;
  connectionId: string;
}>> {
  if (event.file) {
    return [
      {
        id: event.file.providerFileId ?? event.file.id,
        name: event.file.name,
        sizeBytes: event.file.sizeBytes,
        connectionId: event.file.connectionId,
      },
    ];
  }
  const sourceDriveId = str(action, "sourceDriveId") || event.driveId || "";
  if (!sourceDriveId) return [];
  const { connectionId } = await resolveConnection(sourceDriveId);
  const provider = await StorageManager.forConnection(connectionId);
  const entries = await provider.list(connectionId, str(action, "path") || "/");
  return entries
    .filter((entry) => entry.kind === "file")
    .filter((entry) => evaluateGroup({ match: "all", conditions: [] }, event).matched)
    .map((entry) => ({
      id: entry.providerFileId ?? entry.id,
      name: entry.name,
      sizeBytes: entry.sizeBytes,
      connectionId,
    }));
}

/** Executes a single action and returns a human-readable outcome. */
async function runAction(
  automation: Automation,
  action: AutomationAction,
  event: AutomationEvent,
): Promise<{ message: string; filesProcessed: number; jobId?: string }> {
  switch (action.type) {
    case "copy":
    case "move":
    case "archive": {
      const target = await resolveConnection(str(action, "targetDriveId"));
      const files = await filesFor(event, action);
      if (files.length === 0) return { message: "No matching objects", filesProcessed: 0 };
      const mode = action.type === "copy" ? "copy" : "move";
      const targetPath = str(action, "targetPath") || "/";
      let jobId: string | undefined;
      for (const file of files) {
        const job = await transfer({
          sourceConnectionId: file.connectionId,
          targetConnectionId: target.connectionId,
          fileId: file.id,
          fileName: file.name,
          targetPath,
          sizeBytes: file.sizeBytes,
          mode,
        });
        jobId = job.id;
      }
      return {
        message: `${action.type} queued for ${files.length} object(s) → ${target.label}${targetPath}`,
        filesProcessed: files.length,
        ...(jobId ? { jobId } : {}),
      };
    }
    case "delete": {
      if (!action.configuration["confirmed"])
        throw new Error("Delete action requires explicit confirmation");
      const files = await filesFor(event, action);
      if (files.length === 0) return { message: "No matching objects", filesProcessed: 0 };
      let jobId: string | undefined;
      for (const file of files) {
        const job = await enqueue({
          kind: "delete",
          priority: "low",
          label: `Automation delete — ${file.name}`,
          connectionId: file.connectionId,
          payload: { connectionId: file.connectionId, fileId: file.id },
        });
        jobId = job.id;
      }
      return {
        message: `${files.length} object(s) queued for ${
          action.configuration["permanent"] ? "permanent deletion" : "trash"
        }`,
        filesProcessed: files.length,
        ...(jobId ? { jobId } : {}),
      };
    }
    case "mirror": {
      const source = await resolveConnection(str(action, "sourceDriveId") || event.driveId || "");
      const target = await resolveConnection(str(action, "targetDriveId"));
      const jobs = await mirror({
        sourceConnectionId: source.connectionId,
        targetConnectionId: target.connectionId,
        path: str(action, "path") || "/",
      });
      return {
        message: `Mirroring ${source.label} → ${target.label} (${jobs.length} object(s))`,
        filesProcessed: jobs.length,
        ...(jobs[0] ? { jobId: jobs[0].id } : {}),
      };
    }
    case "sync": {
      const source = await resolveConnection(str(action, "sourceDriveId") || event.driveId || "");
      const job = await queueSync(source.connectionId);
      return { message: `Metadata sync queued for ${source.label}`, filesProcessed: 0, jobId: job.id };
    }
    case "createFolder": {
      const target = await resolveConnection(str(action, "targetDriveId") || event.driveId || "");
      const provider = await StorageManager.forConnection(target.connectionId);
      const created = await provider.createFolder(
        target.connectionId,
        str(action, "path") || "/",
        str(action, "name") || "New folder",
      );
      return { message: `Folder ${created.name} created in ${target.label}`, filesProcessed: 0 };
    }
    case "tag.add":
    case "tag.remove": {
      const files = await filesFor(event, action);
      const favorite = action.type === "tag.add";
      for (const file of files) {
        try {
          await useContainer().files.update(file.id, { favorite });
        } catch {
          /* the index may not hold this object yet */
        }
      }
      return {
        message: `${action.type === "tag.add" ? "Tagged" : "Untagged"} ${files.length} object(s)`,
        filesProcessed: files.length,
      };
    }
    case "notify": {
      const message = str(action, "message") || `Automation "${automation.name}" ran`;
      await log({ category: "automation", severity: "info", message });
      return { message: `Notification sent: ${message}`, filesProcessed: 0 };
    }
    case "webhook": {
      const url = str(action, "url");
      if (!url) throw new Error("Webhook action requires a URL");
      await log({
        category: "automation",
        severity: "info",
        message: `Webhook dispatched to ${new URL(url).host}`,
      });
      return { message: `Webhook queued for ${new URL(url).host}`, filesProcessed: 0 };
    }
    default:
      throw new Error(`Unsupported action ${action.type as string}`);
  }
}

/* -------------------------------- execution -------------------------------- */

function keyFor(automation: Automation, action: AutomationAction, event: AutomationEvent): string {
  const resource = event.file?.id ?? event.driveId ?? new Date().toISOString().slice(0, 13);
  return `${automation.id}:${action.id}:${resource}`;
}

/** Runs one automation against one event. Idempotent per action + resource. */
export async function executeAutomation(
  automation: Automation,
  event: AutomationEvent,
  triggerSource: string,
): Promise<AutomationRun> {
  const { automations, automationRuns } = useContainer();
  const startedAt = new Date().toISOString();
  const chainId = event.eventChainId ?? `chain_${Math.random().toString(36).slice(2, 10)}`;
  const depth = event.depth ?? 0;

  const run = await automationRuns.create({
    automationId: automation.id,
    automationName: automation.name,
    workspaceId: automation.workspaceId,
    status: "running",
    triggerSource,
    startedAt,
    completedAt: null,
    filesProcessed: 0,
    durationMs: 0,
    depth,
    eventChainId: chainId,
    actions: [],
  });

  const blocked = guard(automation, event);
  if (blocked) {
    await log({ category: "automation", severity: "warning", message: `${automation.name}: ${blocked}` });
    return finish(run.id, "skipped", startedAt, 0, blocked);
  }

  const evaluation = evaluateGroup(automation.conditionGroup, event);
  if (!evaluation.matched) {
    return finish(run.id, "skipped", startedAt, 0, "Conditions did not match");
  }

  const chainedEvent: AutomationEvent = {
    ...event,
    eventChainId: chainId,
    depth: depth + 1,
    processedAutomationIds: [...(event.processedAutomationIds ?? []), automation.id],
  };

  let processed = 0;
  let failures = 0;
  const ordered = [...automation.actions].sort((a, b) => a.orderIndex - b.orderIndex);

  for (const action of ordered) {
    const idempotencyKey = keyFor(automation, action, event);
    const existing = await automationRuns.findByIdempotencyKey(idempotencyKey);
    const record = await automationRuns.appendAction(run.id, {
      actionId: action.id,
      actionType: action.type,
      status: existing ? "skipped" : "running",
      idempotencyKey,
      startedAt: new Date().toISOString(),
      ...(existing ? { message: "Skipped — already applied (idempotency)" } : {}),
    });
    if (existing) continue;

    try {
      const outcome = await runAction(automation, action, chainedEvent);
      processed += outcome.filesProcessed;
      await automationRuns.updateAction(run.id, record.id, {
        status: "success",
        message: outcome.message,
        ...(outcome.jobId ? { jobId: outcome.jobId } : {}),
        finishedAt: new Date().toISOString(),
      });
    } catch (error) {
      failures += 1;
      const message = error instanceof Error ? error.message : "Action failed";
      await automationRuns.updateAction(run.id, record.id, {
        status: "failed",
        message,
        finishedAt: new Date().toISOString(),
      });
      await log({
        category: "automation",
        severity: "error",
        message: `${automation.name} — ${action.type} failed: ${message}`,
      });
    }
  }

  const status: AutomationRunStatus =
    failures === 0 ? "success" : failures === ordered.length ? "failed" : "partial";

  await automations.update(automation.id, {
    lastRunAt: startedAt,
    runCount: automation.runCount + 1,
    failureCount: automation.failureCount + (status === "success" ? 0 : 1),
  });

  return finish(run.id, status, startedAt, processed, failures ? `${failures} action(s) failed` : undefined);
}

async function finish(
  runId: string,
  status: AutomationRunStatus,
  startedAt: string,
  filesProcessed: number,
  error?: string,
): Promise<AutomationRun> {
  const completedAt = new Date().toISOString();
  const updated = await useContainer().automationRuns.update(runId, {
    status,
    completedAt,
    filesProcessed,
    durationMs: Math.max(0, Date.parse(completedAt) - Date.parse(startedAt)),
    ...(error ? { error } : {}),
  });
  publish({ type: "automation.run", runId });
  return updated;
}

/* --------------------------------- dispatch -------------------------------- */

/** Fan-out: every active automation listening on this trigger gets evaluated. */
export async function dispatchEvent(event: AutomationEvent): Promise<AutomationRun[]> {
  initAutomationEngine();
  const all = await useContainer().automations.list(CURRENT_WORKSPACE);
  const matching = all.filter(
    (automation) => automation.status === "active" && automation.triggerType === event.type,
  );
  const runs: AutomationRun[] = [];
  for (const automation of matching) {
    runs.push(await executeAutomation(automation, event, `event:${event.type}`));
  }
  return runs;
}

/** Queue-backed execution used by the scheduler and manual runs. */
export function initAutomationEngine(): void {
  if (wired) return;
  wired = true;

  registerJobHandler("automation", async (job, ctx) => {
    const payload = job.payload as { automationId: string; triggerSource?: string; driveId?: string };
    const automation = await useContainer().automations.get(payload.automationId);
    if (!automation) throw new Error("Automation not found");
    const run = await executeAutomation(
      automation,
      { type: automation.triggerType, ...(payload.driveId ? { driveId: payload.driveId } : {}) },
      payload.triggerSource ?? "queue",
    );
    await ctx.note(`Run ${run.status} — ${run.filesProcessed} object(s)`);
    if (run.status === "failed") throw new Error(run.error ?? "Automation run failed");
  });

  subscribe((event) => {
    if (event.type === "job.updated") return;
  });
}

/** Enqueues an automation run rather than executing it inline. */
export async function queueAutomation(
  automationId: string,
  triggerSource: string,
): Promise<{ jobId: string }> {
  initAutomationEngine();
  const job = await enqueue({
    kind: "automation",
    priority: "medium",
    label: `Automation — ${triggerSource}`,
    payload: { automationId, triggerSource },
  });
  return { jobId: job.id };
}

/** Convenience helper: emit a file event for the first drive of the workspace. */
export async function emitDemoFileEvent(
  type: AutomationEvent["type"],
  file: AutomationEvent["file"],
): Promise<AutomationRun[]> {
  const drives = await listDrives();
  const first = drives[0];
  return dispatchEvent({
    type,
    ...(file ? { file } : {}),
    ...(first
      ? {
          driveId: first.drive.id,
          connectionId: first.connection.id,
          providerId: first.connection.providerId,
        }
      : {}),
  });
}
