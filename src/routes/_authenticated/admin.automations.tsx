import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import { AdminNav } from "@/components/admin-nav";
import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { describeGroup } from "@/core/rule-evaluator";
import { describeSchedule } from "@/core/scheduler";
import { formatDateTime } from "@/lib/format";
import { allAutomationsQuery, automationMetricsQuery, automationRunsQuery } from "@/lib/queries";

export const Route = createFileRoute("/_authenticated/admin/automations")({
  head: () => ({
    meta: [
      { title: "Automations — ODrive admin" },
      {
        name: "description",
        content:
          "Global automation monitor: rule inventory, execution history, failure rates and loop-protection depth.",
      },
      { property: "og:title", content: "Automations — ODrive admin" },
      {
        property: "og:description",
        content: "Workspace-wide automation execution monitor with per-action audit trail.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdminAutomations,
});

function AdminAutomations() {
  const automations = useQuery(allAutomationsQuery);
  const runs = useQuery(automationRunsQuery());
  const metrics = useQuery(automationMetricsQuery);

  return (
    <AppShell
      title="Automation monitor"
      description="Every rule in the workspace, with execution history and loop-protection telemetry."
    >
      <AdminNav />

      <div className="grid gap-3 sm:grid-cols-4">
        {[
          { label: "Rules", value: metrics.data?.total ?? 0 },
          { label: "Scheduled", value: metrics.data?.scheduled ?? 0 },
          { label: "Failed runs", value: metrics.data?.failedRuns ?? 0 },
          {
            label: "Avg duration",
            value: `${Math.round((metrics.data?.avgDurationMs ?? 0) / 1000)}s`,
          },
        ].map((card) => (
          <div key={card.label} className="panel p-4">
            <p className="text-xs text-muted-foreground">{card.label}</p>
            <p className="font-display text-2xl font-semibold">{card.value}</p>
          </div>
        ))}
      </div>

      <section className="panel mt-4 p-5">
        <h2 className="font-display text-sm font-semibold">Rule inventory</h2>
        <Table className="mt-3">
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Owner</TableHead>
              <TableHead>Trigger</TableHead>
              <TableHead>Conditions</TableHead>
              <TableHead>Max depth</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(automations.data ?? []).map((automation) => (
              <TableRow key={automation.id}>
                <TableCell className="text-xs font-medium">{automation.name}</TableCell>
                <TableCell className="text-xs">{automation.createdBy}</TableCell>
                <TableCell className="text-xs">
                  {automation.triggerType === "schedule"
                    ? describeSchedule(automation.schedule)
                    : automation.triggerType}
                </TableCell>
                <TableCell className="max-w-[18rem] truncate font-mono text-[11px]">
                  {describeGroup(automation.conditionGroup)}
                </TableCell>
                <TableCell className="text-xs">{automation.maxDepth}</TableCell>
                <TableCell>
                  <Badge variant="outline" className="capitalize">
                    {automation.status}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </section>

      <section className="panel mt-4 p-5">
        <h2 className="font-display text-sm font-semibold">Execution audit</h2>
        <div className="mt-3 space-y-3">
          {(runs.data ?? []).map((entry) => (
            <div key={entry.id} className="rounded-lg border border-border p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-medium">{entry.automationName}</p>
                  <p className="font-mono text-[11px] text-muted-foreground">
                    {entry.triggerSource} · chain {entry.eventChainId} · depth {entry.depth}
                  </p>
                </div>
                <div className="text-right text-xs text-muted-foreground">
                  <Badge variant="outline" className="capitalize">
                    {entry.status}
                  </Badge>
                  <p className="mt-1">{formatDateTime(entry.startedAt)}</p>
                </div>
              </div>
              <ul className="mt-2 space-y-1">
                {entry.actions.map((action) => (
                  <li key={action.id} className="flex flex-wrap gap-2 text-[11px]">
                    <span className="font-mono">{action.actionType}</span>
                    <span className="capitalize text-muted-foreground">{action.status}</span>
                    <span className="text-muted-foreground">{action.message}</span>
                    <span className="font-mono text-muted-foreground">{action.idempotencyKey}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>
    </AppShell>
  );
}
