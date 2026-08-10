import { useContainer } from "./container";
import { queueAutomation } from "./automation-engine";
import { log } from "./logs";
import type { Automation, AutomationSchedule } from "./types";
import { DEMO_WORKSPACE_ID } from "@/database/memory";

/**
 * Scheduler adapter. In production this is driven by Cloudflare Cron Triggers
 * calling `runDueAutomations()`; in the browser demo a lightweight ticker plays
 * the same role. The scheduler never executes work itself — it only enqueues
 * automation jobs, so the queue stays the single execution path.
 */

const INTERVAL_MINUTES: Record<AutomationSchedule["interval"], number> = {
  hourly: 60,
  "6h": 360,
  daily: 1440,
  weekly: 10080,
  custom: 60,
};

export function intervalMinutes(schedule: AutomationSchedule): number {
  if (schedule.interval === "custom") return Math.max(5, schedule.everyMinutes ?? 60);
  return INTERVAL_MINUTES[schedule.interval];
}

export function describeSchedule(schedule?: AutomationSchedule): string {
  if (!schedule) return "manual";
  const hour = String(schedule.hour ?? 0).padStart(2, "0");
  switch (schedule.interval) {
    case "hourly":
      return "every hour";
    case "6h":
      return "every 6 hours";
    case "daily":
      return `every day at ${hour}:00`;
    case "weekly":
      return `weekly on day ${schedule.weekday ?? 1} at ${hour}:00`;
    case "custom":
      return `every ${intervalMinutes(schedule)} minutes`;
  }
}

export function nextRunAt(automation: Automation, from = new Date()): string | null {
  if (automation.triggerType !== "schedule" || !automation.schedule) return null;
  const base = automation.lastRunAt ? new Date(automation.lastRunAt) : from;
  return new Date(base.getTime() + intervalMinutes(automation.schedule) * 60_000).toISOString();
}

function isDue(automation: Automation, now: Date): boolean {
  const next = nextRunAt(automation, now);
  return Boolean(next && Date.parse(next) <= now.getTime());
}

/** Entry point for a cron trigger. Returns the automations it enqueued. */
export async function runDueAutomations(now = new Date()): Promise<string[]> {
  const automations = await useContainer().automations.list(DEMO_WORKSPACE_ID);
  const due = automations.filter(
    (automation) =>
      automation.status === "active" && automation.triggerType === "schedule" && isDue(automation, now),
  );
  for (const automation of due) {
    await queueAutomation(automation.id, `schedule:${automation.schedule?.interval ?? "custom"}`);
    await useContainer().automations.update(automation.id, { nextRunAt: nextRunAt(automation, now) });
  }
  if (due.length > 0) {
    await log({
      category: "automation",
      severity: "info",
      message: `Scheduler enqueued ${due.length} automation(s)`,
    });
  }
  return due.map((automation) => automation.id);
}

let ticker: ReturnType<typeof setInterval> | null = null;

/** Demo-mode ticker; a no-op when a real cron adapter is wired up. */
export function startScheduler(everyMs = 60_000): () => void {
  if (ticker) return () => undefined;
  ticker = setInterval(() => void runDueAutomations(), everyMs);
  return () => {
    if (ticker) clearInterval(ticker);
    ticker = null;
  };
}
