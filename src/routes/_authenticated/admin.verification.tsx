import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown } from "lucide-react";
import { toast } from "sonner";

import { AdminNav } from "@/components/admin-nav";
import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { listActions } from "@/core/actions";
import { runVerification, type ReadinessItem, type ReadinessState, type VerificationTarget } from "@/core/readiness";
import { formatDateTime } from "@/lib/format";
import { readinessQuery } from "@/lib/queries";

export const Route = createFileRoute("/_authenticated/admin/verification")({
  head: () => ({
    meta: [
      { title: "Verification — ODrive admin" },
      { name: "description", content: "Production readiness verification for infrastructure, providers and core features." },
      { property: "og:title", content: "Verification — ODrive admin" },
      { property: "og:description", content: "Unified production readiness verification." },
    ],
  }),
  component: AdminVerification,
});

const STATE_CLASS: Record<ReadinessState, string> = {
  Healthy: "border-success/30 bg-success/10 text-success",
  Degraded: "border-warning/30 bg-warning/15 text-warning-foreground",
  Testing: "border-primary/30 bg-primary/10 text-primary",
  Blocked: "border-destructive/30 bg-destructive/10 text-destructive",
  Disabled: "border-border bg-muted text-muted-foreground",
};

function StateBadge({ state }: { state: ReadinessState }) {
  return <Badge variant="outline" className={STATE_CLASS[state]}>{state}</Badge>;
}

function ReadinessRow({ item, onRun }: { item: ReadinessItem; onRun: () => void }) {
  return (
    <details className="group border-t border-border first:border-t-0">
      <summary className="flex cursor-pointer list-none items-center gap-3 py-3">
        <ChevronDown className="size-4 text-muted-foreground transition-transform group-open:rotate-180" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{item.name}</p>
          <p className="truncate text-xs text-muted-foreground">{item.reason}</p>
        </div>
        {item.publicStatus ? <Badge variant="outline" className="capitalize">{item.publicStatus}</Badge> : null}
        <StateBadge state={item.state} />
      </summary>
      <div className="pb-4 pl-7">
        <p className="text-xs text-muted-foreground">
          Last verified: {item.lastVerifiedAt ? formatDateTime(item.lastVerifiedAt) : "never"}
        </p>
        {item.capabilities?.length ? (
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {item.capabilities.map((capability) => (
              <div key={capability.name} className="flex items-center justify-between gap-2 rounded-md border border-border px-2 py-1.5">
                <span className="text-xs">{capability.name}</span>
                <StateBadge state={capability.state} />
              </div>
            ))}
          </div>
        ) : null}
        <Button className="mt-3" size="sm" variant="secondary" onClick={onRun}>
          Retry check
        </Button>
      </div>
    </details>
  );
}

function Group({ title, items, onRun }: { title: string; items: ReadinessItem[]; onRun: (item: ReadinessItem) => void }) {
  return (
    <section className="panel p-5">
      <h2 className="font-display text-sm font-semibold">{title}</h2>
      <div className="mt-3">
        {items.map((item) => <ReadinessRow key={item.id} item={item} onRun={() => onRun(item)} />)}
      </div>
    </section>
  );
}

function AdminVerification() {
  const queryClient = useQueryClient();
  const readiness = useQuery(readinessQuery);
  const run = useMutation({
    mutationFn: ({ target, providerId }: { target: VerificationTarget; providerId?: string }) => runVerification(target, providerId),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["readiness"] });
      queryClient.invalidateQueries({ queryKey: ["provider-states"] });
      toast.success(`Verification finished: ${result.status}`);
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const data = readiness.data;
  const actions = listActions();

  const runItem = (item: ReadinessItem) => {
    if (item.group === "Infrastructure") run.mutate({ target: "infrastructure" });
    else if (item.group === "Providers") run.mutate({ target: "provider", providerId: item.id });
    else run.mutate({ target: "feature" });
  };

  return (
    <AppShell
      title="Verification"
      description="One operational view of production readiness."
      actions={
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="secondary" onClick={() => run.mutate({ target: "infrastructure" })} disabled={run.isPending}>Infrastructure</Button>
          <Button size="sm" variant="secondary" onClick={() => run.mutate({ target: "provider" })} disabled={run.isPending}>Providers</Button>
          <Button size="sm" variant="secondary" onClick={() => run.mutate({ target: "feature" })} disabled={run.isPending}>Features</Button>
          <Button size="sm" onClick={() => run.mutate({ target: "all" })} disabled={run.isPending}>Run all checks</Button>
        </div>
      }
    >
      <AdminNav />
      <section className="panel mb-4 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="font-mono text-xs uppercase tracking-wide text-muted-foreground">Production Readiness</p>
            <h2 className="mt-1 font-display text-2xl font-semibold">{data?.deployment ?? "DEGRADED"}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{data?.reason ?? "Readiness data is loading."}</p>
          </div>
          <Badge variant="outline">{data?.checkedAt ? formatDateTime(data.checkedAt) : "checking"}</Badge>
        </div>
        {data?.blockers.length ? (
          <div className="mt-4 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            {data.blockers.map((item) => <p key={item.id}>{item.name}: {item.reason}</p>)}
          </div>
        ) : null}
      </section>

      <div className="grid gap-4 xl:grid-cols-3">
        <Group title="Infrastructure" items={data?.groups.infrastructure ?? []} onRun={runItem} />
        <Group title="Providers" items={data?.groups.providers ?? []} onRun={runItem} />
        <Group title="Core Features" items={data?.groups.features ?? []} onRun={runItem} />
      </div>

      <section className="panel mt-4 p-5">
        <h2 className="font-display text-sm font-semibold">Recent verification history</h2>
        <div className="mt-3 divide-y divide-border">
          {(data?.recentRuns ?? []).length ? data?.recentRuns.map((entry) => (
            <div key={entry.id} className="flex items-center justify-between gap-3 py-3">
              <div>
                <p className="text-sm font-medium">{entry.target} · {entry.status}</p>
                <p className="text-xs text-muted-foreground">{entry.reason}</p>
              </div>
              <p className="font-mono text-xs text-muted-foreground">{entry.durationMs}ms</p>
            </div>
          )) : <p className="text-sm text-muted-foreground">No verification run recorded in this runtime yet.</p>}
        </div>
      </section>

      <section className="panel mt-4 p-5">
        <h2 className="font-display text-sm font-semibold">Action Registry</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Stable operations exposed through the Universal Action Layer.
        </p>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs text-muted-foreground">
              <tr className="border-b border-border">
                <th className="py-2 pr-4 font-medium">Action</th>
                <th className="py-2 pr-4 font-medium">Mode</th>
                <th className="py-2 pr-4 font-medium">Permissions</th>
                <th className="py-2 pr-4 font-medium">Capabilities</th>
              </tr>
            </thead>
            <tbody>
              {actions.map((action) => (
                <tr key={action.id} className="border-b border-border/60">
                  <td className="py-2 pr-4">
                    <p className="font-mono text-xs">{action.id}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{action.description}</p>
                  </td>
                  <td className="py-2 pr-4"><Badge variant="outline">{action.mode}</Badge></td>
                  <td className="py-2 pr-4 font-mono text-xs text-muted-foreground">{action.permissions.join(", ")}</td>
                  <td className="py-2 pr-4 font-mono text-xs text-muted-foreground">{action.capabilities.join(", ")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </AppShell>
  );
}
