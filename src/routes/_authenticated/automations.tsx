import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, Pause, Play, Plus, Trash2, Zap } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/app-shell";
import { AutomationBuilder } from "@/components/automation-builder";
import { EmptyState } from "@/components/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  deleteAutomation,
  duplicateAutomation,
  runAutomationNow,
  setAutomationStatus,
  testAutomation,
} from "@/core/automations";
import { describeGroup } from "@/core/rule-evaluator";
import { describeSchedule } from "@/core/scheduler";
import { formatDateTime } from "@/lib/format";
import { automationMetricsQuery, automationRunsQuery, automationsQuery } from "@/lib/queries";

export const Route = createFileRoute("/_authenticated/automations")({
  head: () => ({
    meta: [
      { title: "Automations — ODrive" },
      {
        name: "description",
        content:
          "Build storage automations: backup, mirror, archive and route files across every connected drive with event, condition and action rules.",
      },
      { property: "og:title", content: "Automations — ODrive" },
      {
        property: "og:description",
        content: "Event → condition → action rules that work identically on every storage provider.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AutomationsPage,
});

function AutomationsPage() {
  const queryClient = useQueryClient();
  const automations = useQuery(automationsQuery);
  const runs = useQuery(automationRunsQuery());
  const metrics = useQuery(automationMetricsQuery);
  const [builderOpen, setBuilderOpen] = useState(false);

  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: ["automations"] });
    await queryClient.invalidateQueries({ queryKey: ["automation-runs"] });
    await queryClient.invalidateQueries({ queryKey: ["automation-metrics"] });
  };

  const toggle = useMutation({
    mutationFn: ({ id, status }: { id: string; status: "active" | "paused" }) =>
      setAutomationStatus(id, status),
    onSuccess: invalidate,
  });
  const run = useMutation({
    mutationFn: (id: string) => runAutomationNow(id),
    onSuccess: async () => {
      await invalidate();
      toast.success("Automation queued");
    },
  });
  const test = useMutation({
    mutationFn: (id: string) => testAutomation(id),
    onSuccess: async (result) => {
      await invalidate();
      toast.info(`Dry run: ${result.status}`, { description: result.error ?? `${result.filesProcessed} object(s)` });
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const duplicate = useMutation({
    mutationFn: (id: string) => duplicateAutomation(id),
    onSuccess: async () => {
      await invalidate();
      toast.success("Duplicated as paused");
    },
  });
  const remove = useMutation({
    mutationFn: (id: string) => deleteAutomation(id),
    onSuccess: async () => {
      await invalidate();
      toast.success("Automation deleted");
    },
  });

  const stats = metrics.data;

  return (
    <AppShell
      title="Automations"
      description="Rules that move, mirror and archive files across every drive — no provider-specific setup."
      actions={
        <Button onClick={() => setBuilderOpen(true)}>
          <Plus className="size-4" />
          New automation
        </Button>
      }
    >
      <div className="grid gap-3 sm:grid-cols-4">
        {[
          { label: "Active", value: stats?.active ?? 0 },
          { label: "Runs today", value: stats?.runsToday ?? 0 },
          { label: "Failed runs", value: stats?.failedRuns ?? 0 },
          { label: "Objects processed", value: stats?.filesProcessed ?? 0 },
        ].map((card) => (
          <div key={card.label} className="panel p-4">
            <p className="text-xs text-muted-foreground">{card.label}</p>
            <p className="font-display text-2xl font-semibold">{card.value}</p>
          </div>
        ))}
      </div>

      <section className="panel mt-4 p-5">
        <h2 className="font-display text-sm font-semibold">Rules</h2>
        {(automations.data ?? []).length === 0 ? (
          <EmptyState
            icon={Zap}
            title="No automations yet"
            description="Create a rule to back up, mirror or archive files automatically."
          />
        ) : (
          <Table className="mt-3">
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Trigger</TableHead>
                <TableHead>Conditions</TableHead>
                <TableHead>Actions</TableHead>
                <TableHead>Last run</TableHead>
                <TableHead>Status</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {(automations.data ?? []).map((automation) => (
                <TableRow key={automation.id}>
                  <TableCell>
                    <p className="text-sm font-medium">{automation.name}</p>
                    <p className="text-xs text-muted-foreground">{automation.description}</p>
                  </TableCell>
                  <TableCell className="text-xs">
                    {automation.triggerType === "schedule"
                      ? describeSchedule(automation.schedule)
                      : automation.triggerType}
                  </TableCell>
                  <TableCell className="max-w-[16rem] truncate font-mono text-[11px]">
                    {describeGroup(automation.conditionGroup)}
                  </TableCell>
                  <TableCell className="text-xs">
                    {automation.actions.map((action) => action.type).join(" → ")}
                    {automation.dangerous ? (
                      <Badge variant="outline" className="ml-2 text-destructive">
                        destructive
                      </Badge>
                    ) : null}
                  </TableCell>
                  <TableCell className="text-xs">
                    {automation.lastRunAt ? formatDateTime(automation.lastRunAt) : "never"}
                    <span className="block text-muted-foreground">
                      {automation.runCount} runs · {automation.failureCount} failed
                    </span>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="capitalize">
                      {automation.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex flex-wrap justify-end gap-1">
                      <Button size="sm" variant="ghost" onClick={() => run.mutate(automation.id)}>
                        Run
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => test.mutate(automation.id)}>
                        Test
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        aria-label={automation.status === "active" ? "Pause" : "Activate"}
                        onClick={() =>
                          toggle.mutate({
                            id: automation.id,
                            status: automation.status === "active" ? "paused" : "active",
                          })
                        }
                      >
                        {automation.status === "active" ? (
                          <Pause className="size-3.5" />
                        ) : (
                          <Play className="size-3.5" />
                        )}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        aria-label="Duplicate"
                        onClick={() => duplicate.mutate(automation.id)}
                      >
                        <Copy className="size-3.5" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive"
                        aria-label="Delete"
                        onClick={() => remove.mutate(automation.id)}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </section>

      <section className="panel mt-4 p-5">
        <h2 className="font-display text-sm font-semibold">Recent runs</h2>
        <Table className="mt-3">
          <TableHeader>
            <TableRow>
              <TableHead>Automation</TableHead>
              <TableHead>Trigger</TableHead>
              <TableHead>Started</TableHead>
              <TableHead>Objects</TableHead>
              <TableHead>Duration</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(runs.data ?? []).map((entry) => (
              <TableRow key={entry.id}>
                <TableCell className="text-xs">{entry.automationName}</TableCell>
                <TableCell className="font-mono text-[11px]">{entry.triggerSource}</TableCell>
                <TableCell className="text-xs">{formatDateTime(entry.startedAt)}</TableCell>
                <TableCell className="text-xs">{entry.filesProcessed}</TableCell>
                <TableCell className="text-xs">{Math.round(entry.durationMs / 1000)}s</TableCell>
                <TableCell className="text-xs">
                  <Badge variant="outline" className="capitalize">
                    {entry.status}
                  </Badge>
                  {entry.error ? (
                    <span className="ml-2 text-destructive">{entry.error}</span>
                  ) : null}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </section>

      <AutomationBuilder open={builderOpen} onOpenChange={setBuilderOpen} />
    </AppShell>
  );
}
