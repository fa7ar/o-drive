import { useContainer } from "./container";
import { dispatchEvent, executeAutomation, queueAutomation } from "./automation-engine";
import { log } from "./logs";
import { describeSchedule, nextRunAt } from "./scheduler";
import type {
  Automation,
  AutomationEvent,
  AutomationMetrics,
  AutomationRun,
  AutomationTemplate,
} from "./types";
import { CURRENT_WORKSPACE } from "@/core/workspace";

/** Automation service — CRUD, templates, metrics and manual/test execution. */

const DESTRUCTIVE = new Set(["delete", "move", "archive"]);

export const AUTOMATION_TEMPLATES: AutomationTemplate[] = [
  {
    key: "daily-backup",
    name: "Daily backup",
    description: "Mirror a whole drive into a backup drive every night.",
    triggerType: "schedule",
    schedule: { interval: "daily", hour: 2 },
    conditionGroup: { match: "all", conditions: [] },
    actions: [{ type: "mirror", orderIndex: 0, configuration: { path: "/" } }],
  },
  {
    key: "image-archive",
    name: "Image archive",
    description: "Copy every new image into an archive folder.",
    triggerType: "file.created",
    conditionGroup: {
      match: "any",
      conditions: [
        { id: "tpl_jpg", field: "extension", operator: "equals", value: "jpg" },
        { id: "tpl_png", field: "extension", operator: "equals", value: "png" },
      ],
    },
    actions: [
      { type: "copy", orderIndex: 0, configuration: { targetPath: "/images", preserveMetadata: true } },
    ],
  },
  {
    key: "large-files",
    name: "Large file routing",
    description: "Move uploads above 500 MB into cheaper cold storage.",
    triggerType: "upload.completed",
    conditionGroup: {
      match: "all",
      conditions: [
        { id: "tpl_size", field: "sizeBytes", operator: "greater_than", value: "524288000" },
      ],
    },
    actions: [{ type: "move", orderIndex: 0, configuration: { targetPath: "/cold", confirmed: true } }],
  },
  {
    key: "sync-on-connect",
    name: "Index on connect",
    description: "Run a metadata sync whenever a new drive is connected.",
    triggerType: "drive.connected",
    conditionGroup: { match: "all", conditions: [] },
    actions: [{ type: "sync", orderIndex: 0, configuration: {} }],
  },
];

export async function listAutomations(): Promise<Automation[]> {
  return useContainer().automations.list(CURRENT_WORKSPACE);
}

export async function listAllAutomations(): Promise<Automation[]> {
  return useContainer().automations.listAll();
}

export async function getAutomation(id: string): Promise<Automation | null> {
  return useContainer().automations.get(id);
}

export async function listRuns(filter: { automationId?: string; limit?: number } = {}): Promise<
  AutomationRun[]
> {
  return useContainer().automationRuns.list(filter);
}

export interface AutomationDraft {
  name: string;
  description?: string;
  triggerType: Automation["triggerType"];
  schedule?: Automation["schedule"];
  conditionGroup: Automation["conditionGroup"];
  actions: Automation["actions"];
  status?: Automation["status"];
}

export async function createAutomation(draft: AutomationDraft): Promise<Automation> {
  const dangerous = draft.actions.some((action) => DESTRUCTIVE.has(action.type));
  const created = await useContainer().automations.create({
    workspaceId: CURRENT_WORKSPACE,
    name: draft.name.trim() || "Untitled automation",
    ...(draft.description ? { description: draft.description } : {}),
    status: draft.status ?? "active",
    triggerType: draft.triggerType,
    ...(draft.schedule ? { schedule: draft.schedule } : {}),
    conditionGroup: draft.conditionGroup,
    actions: draft.actions,
    createdBy: "you",
    lastRunAt: null,
    nextRunAt: null,
    runCount: 0,
    failureCount: 0,
    dangerous,
    maxDepth: 5,
  });
  const withSchedule = await useContainer().automations.update(created.id, {
    nextRunAt: nextRunAt(created),
  });
  await log({
    category: "automation",
    severity: "info",
    message: `Automation "${withSchedule.name}" created (${describeSchedule(withSchedule.schedule)})`,
  });
  return withSchedule;
}

export async function updateAutomation(id: string, patch: Partial<Automation>): Promise<Automation> {
  const next = await useContainer().automations.update(id, patch);
  if (patch.actions) {
    return useContainer().automations.update(id, {
      dangerous: patch.actions.some((action) => DESTRUCTIVE.has(action.type)),
    });
  }
  return next;
}

export async function setAutomationStatus(
  id: string,
  status: Automation["status"],
): Promise<Automation> {
  const updated = await updateAutomation(id, { status });
  await log({
    category: "automation",
    severity: "info",
    message: `Automation "${updated.name}" is now ${status}`,
  });
  return updated;
}

export async function deleteAutomation(id: string): Promise<void> {
  const automation = await getAutomation(id);
  await useContainer().automations.remove(id);
  if (automation) {
    await log({
      category: "automation",
      severity: "warning",
      message: `Automation "${automation.name}" deleted`,
    });
  }
}

export async function duplicateAutomation(id: string): Promise<Automation> {
  const source = await getAutomation(id);
  if (!source) throw new Error("Automation not found");
  return createAutomation({
    name: `${source.name} (copy)`,
    ...(source.description ? { description: source.description } : {}),
    triggerType: source.triggerType,
    ...(source.schedule ? { schedule: source.schedule } : {}),
    conditionGroup: source.conditionGroup,
    actions: source.actions,
    status: "paused",
  });
}

/** Runs the automation now, through the job queue. */
export async function runAutomationNow(id: string): Promise<{ jobId: string }> {
  return queueAutomation(id, "manual");
}

/** Dry run: evaluates and executes inline so the operator sees the outcome. */
export async function testAutomation(id: string, event?: AutomationEvent): Promise<AutomationRun> {
  const automation = await getAutomation(id);
  if (!automation) throw new Error("Automation not found");
  return executeAutomation(automation, event ?? { type: automation.triggerType }, "test");
}

/** Simulates an external trigger, used by the "simulate event" control. */
export async function simulateEvent(event: AutomationEvent): Promise<AutomationRun[]> {
  return dispatchEvent(event);
}

export async function automationMetrics(): Promise<AutomationMetrics> {
  const [automations, runs] = await Promise.all([listAutomations(), listRuns({ limit: 200 })]);
  const today = new Date().toISOString().slice(0, 10);
  const runsToday = runs.filter((run) => run.startedAt.slice(0, 10) === today);
  const durations = runs.filter((run) => run.durationMs > 0);
  return {
    total: automations.length,
    active: automations.filter((entry) => entry.status === "active").length,
    paused: automations.filter((entry) => entry.status === "paused").length,
    scheduled: automations.filter((entry) => entry.triggerType === "schedule").length,
    runsToday: runsToday.length,
    failedRuns: runs.filter((run) => run.status === "failed").length,
    filesProcessed: runs.reduce((total, run) => total + run.filesProcessed, 0),
    avgDurationMs: durations.length
      ? Math.round(durations.reduce((total, run) => total + run.durationMs, 0) / durations.length)
      : 0,
  };
}
