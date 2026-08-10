import type {
  AutomationCondition,
  AutomationEvent,
  ConditionGroup,
  ConditionOperator,
} from "./types";

/**
 * Rule evaluator — generic condition matching. It knows nothing about storage
 * providers: every condition reads from a normalised event snapshot, so the same
 * rule works for Google Drive, S3, R2, OneDrive or Telegram.
 */

export type EvaluationSnapshot = Record<string, string | number | null>;

export function snapshotOf(event: AutomationEvent): EvaluationSnapshot {
  const file = event.file;
  const extension = file ? (file.name.split(".").pop() ?? "").toLowerCase() : null;
  return {
    name: file?.name ?? null,
    extension: file && file.name.includes(".") ? extension : null,
    mimeType: file?.mimeType ?? null,
    sizeBytes: file?.sizeBytes ?? null,
    path: file?.path ?? null,
    createdAt: file?.modifiedAt ?? null,
    modifiedAt: file?.modifiedAt ?? null,
    driveId: event.driveId ?? null,
    providerId: event.providerId ?? null,
    connectionId: event.connectionId ?? file?.connectionId ?? null,
    transferStatus: event.transferStatus ?? null,
  };
}

function compare(actual: string | number | null, condition: AutomationCondition): boolean {
  if (actual === null || actual === undefined) return false;
  const text = String(actual).toLowerCase();
  const expected = condition.value.trim();
  const expectedText = expected.toLowerCase();
  const numeric = Number(expected);
  const actualNumber = typeof actual === "number" ? actual : Number(actual);

  const operators: Record<ConditionOperator, () => boolean> = {
    equals: () => text === expectedText,
    not_equals: () => text !== expectedText,
    contains: () => text.includes(expectedText),
    starts_with: () => text.startsWith(expectedText),
    ends_with: () => text.endsWith(expectedText),
    matches: () => {
      try {
        return new RegExp(expected, "i").test(String(actual));
      } catch {
        return false;
      }
    },
    greater_than: () => Number.isFinite(actualNumber) && Number.isFinite(numeric) && actualNumber > numeric,
    less_than: () => Number.isFinite(actualNumber) && Number.isFinite(numeric) && actualNumber < numeric,
    before: () => new Date(String(actual)).getTime() < new Date(expected).getTime(),
    after: () => new Date(String(actual)).getTime() > new Date(expected).getTime(),
  };

  return operators[condition.operator]();
}

export interface EvaluationResult {
  matched: boolean;
  details: Array<{ condition: AutomationCondition; matched: boolean; actual: string | number | null }>;
}

export function evaluateGroup(group: ConditionGroup, event: AutomationEvent): EvaluationResult {
  const snapshot = snapshotOf(event);
  const details = group.conditions.map((condition) => {
    const actual = snapshot[condition.field] ?? null;
    return { condition, matched: compare(actual, condition), actual };
  });
  if (details.length === 0) return { matched: true, details };
  const matched =
    group.match === "all" ? details.every((d) => d.matched) : details.some((d) => d.matched);
  return { matched, details };
}

export function describeCondition(condition: AutomationCondition): string {
  const label = condition.operator.replace(/_/g, " ");
  return `${condition.field} ${label} ${condition.value}`;
}

export function describeGroup(group: ConditionGroup): string {
  if (group.conditions.length === 0) return "always";
  const joiner = group.match === "all" ? " AND " : " OR ";
  return group.conditions.map(describeCondition).join(joiner);
}
