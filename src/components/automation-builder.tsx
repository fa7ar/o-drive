import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Wand2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { AUTOMATION_TEMPLATES, createAutomation } from "@/core/automations";
import type {
  AutomationAction,
  AutomationActionType,
  AutomationCondition,
  AutomationTriggerType,
  ConditionField,
  ConditionOperator,
  ScheduleInterval,
} from "@/core/types";
import { drivesQuery } from "@/lib/queries";

const TRIGGERS: Array<{ value: AutomationTriggerType; label: string }> = [
  { value: "file.created", label: "File created" },
  { value: "file.updated", label: "File updated" },
  { value: "file.moved", label: "File moved" },
  { value: "file.copied", label: "File copied" },
  { value: "file.deleted", label: "File deleted" },

  { value: "upload.completed", label: "Upload completed" },
  { value: "transfer.completed", label: "Transfer completed" },
  { value: "drive.connected", label: "Drive connected" },
  { value: "sync.completed", label: "Sync completed" },
  { value: "schedule", label: "On a schedule" },
  { value: "manual", label: "Manual only" },
];

const FIELDS: ConditionField[] = [
  "name",
  "extension",
  "mimeType",
  "sizeBytes",
  "path",
  "modifiedAt",
  "driveId",
  "providerId",
];

const OPERATORS: ConditionOperator[] = [
  "equals",
  "not_equals",
  "contains",
  "starts_with",
  "ends_with",
  "matches",
  "greater_than",
  "less_than",
  "before",
  "after",
];

const ACTIONS: Array<{ value: AutomationActionType; label: string; destructive?: boolean }> = [
  { value: "copy", label: "Copy to drive" },
  { value: "move", label: "Move to drive", destructive: true },
  { value: "mirror", label: "Mirror folder" },
  { value: "sync", label: "Sync metadata" },
  { value: "archive", label: "Archive", destructive: true },
  { value: "createFolder", label: "Create folder" },
  { value: "tag.add", label: "Add favourite tag" },
  { value: "tag.remove", label: "Remove favourite tag" },
  { value: "delete", label: "Delete", destructive: true },
  { value: "notify", label: "Notify" },
  { value: "webhook", label: "Call webhook" },
];

const INTERVALS: ScheduleInterval[] = ["hourly", "6h", "daily", "weekly", "custom"];

const uid = (prefix: string) => `${prefix}_${Math.random().toString(36).slice(2, 8)}`;

/** Provider-agnostic automation builder: trigger → conditions → actions. */
export function AutomationBuilder({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const drives = useQuery(drivesQuery);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [trigger, setTrigger] = useState<AutomationTriggerType>("file.created");
  const [interval, setInterval] = useState<ScheduleInterval>("daily");
  const [hour, setHour] = useState("2");
  const [everyMinutes, setEveryMinutes] = useState("60");
  const [match, setMatch] = useState<"all" | "any">("all");
  const [conditions, setConditions] = useState<AutomationCondition[]>([]);
  const [actions, setActions] = useState<AutomationAction[]>([
    { id: uid("act"), type: "copy", orderIndex: 0, configuration: { targetPath: "/" } },
  ]);

  const driveOptions = drives.data ?? [];

  function applyTemplate(key: string) {
    const template = AUTOMATION_TEMPLATES.find((entry) => entry.key === key);
    if (!template) return;
    setName(template.name);
    setDescription(template.description);
    setTrigger(template.triggerType);
    if (template.schedule) {
      setInterval(template.schedule.interval);
      setHour(String(template.schedule.hour ?? 2));
    }
    setMatch(template.conditionGroup.match);
    setConditions(template.conditionGroup.conditions.map((c) => ({ ...c, id: uid("cnd") })));
    setActions(template.actions.map((action) => ({ ...action, id: uid("act") })));
  }

  function patchAction(id: string, patch: Partial<AutomationAction>) {
    setActions((previous) =>
      previous.map((action) => (action.id === id ? { ...action, ...patch } : action)),
    );
  }

  function patchConfig(id: string, key: string, value: string | boolean) {
    setActions((previous) =>
      previous.map((action) =>
        action.id === id ? { ...action, configuration: { ...action.configuration, [key]: value } } : action,
      ),
    );
  }

  const save = useMutation({
    mutationFn: async () => {
      if (actions.length === 0) throw new Error("Add at least one action");
      return createAutomation({
        name,
        ...(description ? { description } : {}),
        triggerType: trigger,
        ...(trigger === "schedule"
          ? {
              schedule: {
                interval,
                hour: Number(hour) || 0,
                ...(interval === "custom" ? { everyMinutes: Number(everyMinutes) || 60 } : {}),
              },
            }
          : {}),
        conditionGroup: { match, conditions },
        actions: actions.map((action, index) => ({ ...action, orderIndex: index })),
      });
    },
    onSuccess: async (created) => {
      await queryClient.invalidateQueries({ queryKey: ["automations"] });
      await queryClient.invalidateQueries({ queryKey: ["automation-metrics"] });
      toast.success(`“${created.name}” is live`);
      onOpenChange(false);
      setName("");
      setDescription("");
      setConditions([]);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const needsTarget = (type: AutomationActionType) =>
    ["copy", "move", "archive", "mirror", "createFolder"].includes(type);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>New automation</DialogTitle>
          <DialogDescription>
            Event → conditions → actions. Rules work the same on every connected drive.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div className="space-y-2">
            <Label>Start from a template</Label>
            <div className="flex flex-wrap gap-2">
              {AUTOMATION_TEMPLATES.map((template) => (
                <Button
                  key={template.key}
                  size="sm"
                  variant="secondary"
                  onClick={() => applyTemplate(template.key)}
                >
                  <Wand2 className="size-3.5" />
                  {template.name}
                </Button>
              ))}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="automation-name">Name</Label>
              <Input
                id="automation-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Nightly backup"
              />
            </div>
            <div className="space-y-2">
              <Label>Trigger</Label>
              <Select value={trigger} onValueChange={(value) => setTrigger(value as AutomationTriggerType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TRIGGERS.map((entry) => (
                    <SelectItem key={entry.value} value={entry.value}>
                      {entry.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="automation-description">Description</Label>
            <Textarea
              id="automation-description"
              rows={2}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="What should this rule do?"
            />
          </div>

          {trigger === "schedule" ? (
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-2">
                <Label>Interval</Label>
                <Select value={interval} onValueChange={(value) => setInterval(value as ScheduleInterval)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {INTERVALS.map((entry) => (
                      <SelectItem key={entry} value={entry}>
                        {entry}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="automation-hour">Hour (UTC)</Label>
                <Input
                  id="automation-hour"
                  value={hour}
                  onChange={(event) => setHour(event.target.value.replace(/\D/g, ""))}
                />
              </div>
              {interval === "custom" ? (
                <div className="space-y-2">
                  <Label htmlFor="automation-minutes">Every N minutes</Label>
                  <Input
                    id="automation-minutes"
                    value={everyMinutes}
                    onChange={(event) => setEveryMinutes(event.target.value.replace(/\D/g, ""))}
                  />
                </div>
              ) : null}
            </div>
          ) : null}

          <section className="space-y-3 rounded-lg border border-border p-3">
            <div className="flex items-center justify-between">
              <Label>Conditions</Label>
              <div className="flex items-center gap-2">
                <Select value={match} onValueChange={(value) => setMatch(value as "all" | "any")}>
                  <SelectTrigger className="h-8 w-28">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Match all</SelectItem>
                    <SelectItem value="any">Match any</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() =>
                    setConditions((previous) => [
                      ...previous,
                      { id: uid("cnd"), field: "extension", operator: "equals", value: "" },
                    ])
                  }
                >
                  <Plus className="size-3.5" />
                  Condition
                </Button>
              </div>
            </div>

            {conditions.length === 0 ? (
              <p className="text-xs text-muted-foreground">No conditions — the rule always runs.</p>
            ) : (
              conditions.map((condition) => (
                <div key={condition.id} className="grid gap-2 sm:grid-cols-[1fr_1fr_1fr_auto]">
                  <Select
                    value={condition.field}
                    onValueChange={(value) =>
                      setConditions((previous) =>
                        previous.map((entry) =>
                          entry.id === condition.id ? { ...entry, field: value as ConditionField } : entry,
                        ),
                      )
                    }
                  >
                    <SelectTrigger className="h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {FIELDS.map((field) => (
                        <SelectItem key={field} value={field}>
                          {field}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select
                    value={condition.operator}
                    onValueChange={(value) =>
                      setConditions((previous) =>
                        previous.map((entry) =>
                          entry.id === condition.id
                            ? { ...entry, operator: value as ConditionOperator }
                            : entry,
                        ),
                      )
                    }
                  >
                    <SelectTrigger className="h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {OPERATORS.map((operator) => (
                        <SelectItem key={operator} value={operator}>
                          {operator.replace(/_/g, " ")}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    className="h-8"
                    value={condition.value}
                    placeholder="value"
                    onChange={(event) =>
                      setConditions((previous) =>
                        previous.map((entry) =>
                          entry.id === condition.id ? { ...entry, value: event.target.value } : entry,
                        ),
                      )
                    }
                  />
                  <Button
                    size="sm"
                    variant="ghost"
                    aria-label="Remove condition"
                    onClick={() =>
                      setConditions((previous) => previous.filter((entry) => entry.id !== condition.id))
                    }
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              ))
            )}
          </section>

          <section className="space-y-3 rounded-lg border border-border p-3">
            <div className="flex items-center justify-between">
              <Label>Actions</Label>
              <Button
                size="sm"
                variant="secondary"
                onClick={() =>
                  setActions((previous) => [
                    ...previous,
                    { id: uid("act"), type: "notify", orderIndex: previous.length, configuration: {} },
                  ])
                }
              >
                <Plus className="size-3.5" />
                Action
              </Button>
            </div>

            {actions.map((action, index) => (
              <div key={action.id} className="space-y-2 border-t border-border pt-3 first:border-0 first:pt-0">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[11px] text-muted-foreground">{index + 1}</span>
                  <Select
                    value={action.type}
                    onValueChange={(value) => patchAction(action.id, { type: value as AutomationActionType })}
                  >
                    <SelectTrigger className="h-8 max-w-[14rem]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ACTIONS.map((entry) => (
                        <SelectItem key={entry.value} value={entry.value}>
                          {entry.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    size="sm"
                    variant="ghost"
                    aria-label="Remove action"
                    onClick={() => setActions((previous) => previous.filter((entry) => entry.id !== action.id))}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>

                <div className="grid gap-2 sm:grid-cols-2">
                  {needsTarget(action.type) ? (
                    <Select
                      value={String(action.configuration["targetDriveId"] ?? "")}
                      onValueChange={(value) => patchConfig(action.id, "targetDriveId", value)}
                    >
                      <SelectTrigger className="h-8">
                        <SelectValue placeholder="Target drive" />
                      </SelectTrigger>
                      <SelectContent>
                        {driveOptions.map((view) => (
                          <SelectItem key={view.drive.id} value={view.drive.id}>
                            {view.drive.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : null}
                  {action.type === "mirror" || action.type === "sync" ? (
                    <Select
                      value={String(action.configuration["sourceDriveId"] ?? "")}
                      onValueChange={(value) => patchConfig(action.id, "sourceDriveId", value)}
                    >
                      <SelectTrigger className="h-8">
                        <SelectValue placeholder="Source drive" />
                      </SelectTrigger>
                      <SelectContent>
                        {driveOptions.map((view) => (
                          <SelectItem key={view.drive.id} value={view.drive.id}>
                            {view.drive.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : null}
                  {["copy", "move", "archive"].includes(action.type) ? (
                    <Input
                      className="h-8"
                      placeholder="Target path (/archive)"
                      value={String(action.configuration["targetPath"] ?? "")}
                      onChange={(event) => patchConfig(action.id, "targetPath", event.target.value)}
                    />
                  ) : null}
                  {["mirror", "createFolder"].includes(action.type) ? (
                    <Input
                      className="h-8"
                      placeholder="Path (/)"
                      value={String(action.configuration["path"] ?? "")}
                      onChange={(event) => patchConfig(action.id, "path", event.target.value)}
                    />
                  ) : null}
                  {action.type === "createFolder" ? (
                    <Input
                      className="h-8"
                      placeholder="Folder name"
                      value={String(action.configuration["name"] ?? "")}
                      onChange={(event) => patchConfig(action.id, "name", event.target.value)}
                    />
                  ) : null}
                  {action.type === "notify" ? (
                    <Input
                      className="h-8"
                      placeholder="Message"
                      value={String(action.configuration["message"] ?? "")}
                      onChange={(event) => patchConfig(action.id, "message", event.target.value)}
                    />
                  ) : null}
                  {action.type === "webhook" ? (
                    <Input
                      className="h-8"
                      placeholder="https://example.com/hook"
                      value={String(action.configuration["url"] ?? "")}
                      onChange={(event) => patchConfig(action.id, "url", event.target.value)}
                    />
                  ) : null}
                </div>

                {["delete", "move", "archive"].includes(action.type) ? (
                  <label className="flex items-center gap-2 text-xs text-warning-foreground">
                    <input
                      type="checkbox"
                      checked={Boolean(action.configuration["confirmed"])}
                      onChange={(event) => patchConfig(action.id, "confirmed", event.target.checked)}
                    />
                    I understand this action modifies or removes files
                  </label>
                ) : null}
              </div>
            ))}
          </section>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending || !name.trim()}>
            {save.isPending ? "Saving…" : "Create automation"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
