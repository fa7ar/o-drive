import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Play, Plus, Pause, RotateCcw } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  createBackupSyncPolicy,
  createStoragePool,
  runBackupSyncPolicy,
  setBackupSyncPolicyStatus,
  type BackupSyncMode,
  type BackupSyncSchedule,
  type DestinationKind,
  type RoutingStrategyId,
} from "@/core/backup-sync";
import { formatDateTime } from "@/lib/format";
import { backupSyncQuery, connectionsQuery } from "@/lib/queries";

export const Route = createFileRoute("/_authenticated/backup-sync")({
  head: () => ({
    meta: [
      { title: "Backup & Sync — ODrive" },
      { name: "description", content: "Create backup and sync policies with storage pools and smart routing." },
      { property: "og:title", content: "Backup & Sync — ODrive" },
      { property: "og:description", content: "Backup policies, sync runs and storage pool routing." },
    ],
  }),
  component: BackupSyncPage,
});

function BackupSyncPage() {
  const queryClient = useQueryClient();
  const backupSync = useQuery(backupSyncQuery);
  const connections = useQuery(connectionsQuery);
  const [tab, setTab] = useState("policies");

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["backup-sync"] });
    queryClient.invalidateQueries({ queryKey: ["transfers"] });
  };
  const snapshot = backupSync.data;
  const connected = (connections.data ?? []).filter((connection) => connection.status === "connected");

  const runPolicy = useMutation({
    mutationFn: (policyId: string) => runBackupSyncPolicy(policyId),
    onSuccess: (run) => {
      invalidate();
      toast.success(run.status === "completed" ? "Policy run queued" : "Policy run failed", { description: run.reason });
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const status = useMutation({
    mutationFn: ({ id, next }: { id: string; next: "active" | "paused" }) => setBackupSyncPolicyStatus(id, next),
    onSuccess: (_, input) => {
      invalidate();
      toast.success(input.next === "active" ? "Policy resumed" : "Policy paused");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <AppShell
      title="Backup & Sync"
      description="Policies, storage pools and routing decisions across connected providers."
      actions={<Button size="sm" onClick={() => setTab("policies")}><Plus className="size-4" /> New policy</Button>}
    >
      <div className="grid gap-3 md:grid-cols-4">
        <Metric label="Policies" value={String(snapshot?.policies.length ?? 0)} />
        <Metric label="Storage pools" value={String(snapshot?.pools.length ?? 0)} />
        <Metric label="Runs" value={String(snapshot?.runs.length ?? 0)} />
        <Metric label="Strategies" value={String(snapshot?.routingStrategies.length ?? 0)} />
      </div>

      <Tabs value={tab} onValueChange={setTab} className="mt-4">
        <TabsList>
          <TabsTrigger value="policies">Policies</TabsTrigger>
          <TabsTrigger value="runs">Runs</TabsTrigger>
          <TabsTrigger value="pools">Storage Pools</TabsTrigger>
        </TabsList>

        <TabsContent value="policies" className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
          <section className="panel">
            <header className="border-b border-border px-4 py-3">
              <h2 className="font-display text-sm font-semibold">Backup & sync policies</h2>
            </header>
            {snapshot?.policies.length ? (
              <div className="divide-y divide-border">
                {snapshot.policies.map((policy) => (
                  <div key={policy.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                    <div className="min-w-56 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium">{policy.name}</p>
                        <Badge variant="outline">{policy.mode}</Badge>
                        <Badge variant="outline" className={policy.status === "active" ? "border-success/30 bg-success/10 text-success" : ""}>{policy.status}</Badge>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {connectionName(connected, policy.sourceConnectionId)} → {policy.destination.kind}:{destinationName(snapshot.pools, connected, policy.destination)} · {policy.schedule} · keep {policy.retentionDays} days
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Last: {policy.lastRunAt ? formatDateTime(policy.lastRunAt) : "never"} · Next: {policy.nextRunAt ? formatDateTime(policy.nextRunAt) : "manual"}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" onClick={() => runPolicy.mutate(policy.id)} disabled={runPolicy.isPending || policy.status !== "active"}>
                        <Play className="size-3.5" /> Run
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => status.mutate({ id: policy.id, next: policy.status === "active" ? "paused" : "active" })}
                      >
                        {policy.status === "active" ? <Pause className="size-3.5" /> : <RotateCcw className="size-3.5" />}
                        {policy.status === "active" ? "Pause" : "Resume"}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="px-4 py-8 text-center text-sm text-muted-foreground">No backup or sync policy yet.</p>
            )}
          </section>
          <PolicyCreator pools={snapshot?.pools ?? []} connections={connected} invalidate={invalidate} />
        </TabsContent>

        <TabsContent value="runs">
          <section className="panel">
            <header className="border-b border-border px-4 py-3">
              <h2 className="font-display text-sm font-semibold">Run history</h2>
            </header>
            {snapshot?.runs.length ? (
              <div className="divide-y divide-border">
                {snapshot.runs.map((run) => (
                  <div key={run.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{run.status}</Badge>
                        <p className="text-sm font-medium">{policyName(snapshot.policies, run.policyId)}</p>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">{run.reason}</p>
                      <p className="mt-1 font-mono text-[11px] text-muted-foreground">
                        selected: {run.selectedConnectionId ?? "none"} · attempts: {run.attemptedConnectionIds.join(", ") || "none"}
                      </p>
                    </div>
                    <p className="text-xs text-muted-foreground">{formatDateTime(run.startedAt)}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="px-4 py-8 text-center text-sm text-muted-foreground">No policy runs yet.</p>
            )}
          </section>
        </TabsContent>

        <TabsContent value="pools" className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
          <section className="panel">
            <header className="border-b border-border px-4 py-3">
              <h2 className="font-display text-sm font-semibold">Storage pools</h2>
            </header>
            {snapshot?.pools.length ? (
              <div className="divide-y divide-border">
                {snapshot.pools.map((pool) => (
                  <div key={pool.id} className="px-4 py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium">{pool.name}</p>
                      <Badge variant="outline">{pool.strategy}</Badge>
                      {pool.healthAware ? <Badge variant="outline">health-aware</Badge> : null}
                      {pool.failover ? <Badge variant="outline">failover</Badge> : null}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Cursor {pool.routingCursor} · nonce {pool.routingNonce} · {pool.members.length} connections
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {pool.members.map((member) => (
                        <span key={member.connectionId} className="rounded border border-border bg-surface px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">
                          {connectionName(connected, member.connectionId)} · w{member.weight} · p{member.priority}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="px-4 py-8 text-center text-sm text-muted-foreground">No storage pool yet.</p>
            )}
          </section>
          <PoolCreator connections={connected} strategies={snapshot?.routingStrategies ?? []} invalidate={invalidate} />
        </TabsContent>
      </Tabs>
    </AppShell>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="panel p-4">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 font-display text-2xl font-semibold">{value}</p>
    </div>
  );
}

type Conn = { id: string; name: string };
type Pool = { id: string; name: string };

function connectionName(connections: Conn[], id: string) {
  return connections.find((connection) => connection.id === id)?.name ?? id;
}

function policyName(policies: Array<{ id: string; name: string }>, id: string) {
  return policies.find((policy) => policy.id === id)?.name ?? id;
}

function destinationName(pools: Pool[], connections: Conn[], destination: { kind: DestinationKind; id: string }) {
  return destination.kind === "pool"
    ? pools.find((pool) => pool.id === destination.id)?.name ?? destination.id
    : connectionName(connections, destination.id);
}

function PolicyCreator({ pools, connections, invalidate }: { pools: Pool[]; connections: Conn[]; invalidate: () => void }) {
  const [name, setName] = useState("Daily work backup");
  const [source, setSource] = useState("");
  const [destinationKind, setDestinationKind] = useState<DestinationKind>("pool");
  const [destinationId, setDestinationId] = useState("");
  const [mode, setMode] = useState<BackupSyncMode>("backup");
  const [schedule, setSchedule] = useState<BackupSyncSchedule>("daily");
  const [retention, setRetention] = useState("30");
  const destinations = destinationKind === "pool" ? pools : connections;
  const create = useMutation({
    mutationFn: () => createBackupSyncPolicy({
      name,
      sourceConnectionId: source || connections[0]?.id || "",
      destinationKind,
      destinationId: destinationId || destinations[0]?.id || "",
      mode,
      schedule,
      retentionDays: Number(retention) || 30,
    }),
    onSuccess: () => {
      invalidate();
      toast.success("Backup/sync policy created");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <section className="panel p-5">
      <h2 className="font-display text-sm font-semibold">Create policy</h2>
      <div className="mt-4 space-y-3">
        <Field label="Name"><Input value={name} onChange={(event) => setName(event.target.value)} /></Field>
        <Field label="Source"><Picker value={source} onValueChange={setSource} placeholder="Source connection" items={connections} /></Field>
        <Field label="Mode"><Picker value={mode} onValueChange={(value) => setMode(value as BackupSyncMode)} items={[{ id: "backup", name: "Backup" }, { id: "sync", name: "Sync" }]} /></Field>
        <Field label="Destination type"><Picker value={destinationKind} onValueChange={(value) => { setDestinationKind(value as DestinationKind); setDestinationId(""); }} items={[{ id: "pool", name: "Storage Pool" }, { id: "connection", name: "Direct Connection" }]} /></Field>
        <Field label="Destination"><Picker value={destinationId} onValueChange={setDestinationId} placeholder="Destination" items={destinations} /></Field>
        <Field label="Schedule"><Picker value={schedule} onValueChange={(value) => setSchedule(value as BackupSyncSchedule)} items={[{ id: "manual", name: "Manual" }, { id: "hourly", name: "Hourly" }, { id: "daily", name: "Daily" }, { id: "weekly", name: "Weekly" }]} /></Field>
        <Field label="Retention"><Input value={retention} onChange={(event) => setRetention(event.target.value)} /></Field>
        <Button className="w-full" onClick={() => create.mutate()} disabled={!connections.length || !destinations.length || create.isPending}>Create policy</Button>
      </div>
    </section>
  );
}

function PoolCreator({
  connections,
  strategies,
  invalidate,
}: {
  connections: Conn[];
  strategies: Array<{ id: RoutingStrategyId; label: string }>;
  invalidate: () => void;
}) {
  const [name, setName] = useState("Backup Storage");
  const [strategy, setStrategy] = useState<RoutingStrategyId>("weighted-round-robin");
  const [selected, setSelected] = useState<string[]>([]);
  const [healthAware, setHealthAware] = useState(true);
  const [failover, setFailover] = useState(true);
  const weights = useMemo(() => selected.map((connectionId, index) => ({ connectionId, weight: index === 0 ? 50 : index === 1 ? 30 : 20, priority: index + 1 })), [selected]);
  const create = useMutation({
    mutationFn: () => createStoragePool({ name, strategy, members: weights, healthAware, failover }),
    onSuccess: () => {
      invalidate();
      toast.success("Storage pool created");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <section className="panel p-5">
      <h2 className="font-display text-sm font-semibold">Create storage pool</h2>
      <div className="mt-4 space-y-3">
        <Field label="Pool name"><Input value={name} onChange={(event) => setName(event.target.value)} /></Field>
        <Field label="Strategy"><Picker value={strategy} onValueChange={(value) => setStrategy(value as RoutingStrategyId)} items={strategies.map((item) => ({ id: item.id, name: item.label }))} /></Field>
        <div>
          <Label>Connections</Label>
          <div className="mt-2 space-y-2">
            {connections.map((connection) => (
              <label key={connection.id} className="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm">
                <Checkbox
                  checked={selected.includes(connection.id)}
                  onCheckedChange={(checked) =>
                    setSelected((current) => checked ? [...current, connection.id] : current.filter((id) => id !== connection.id))
                  }
                />
                {connection.name}
              </label>
            ))}
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm"><Checkbox checked={healthAware} onCheckedChange={(checked) => setHealthAware(Boolean(checked))} /> Health-aware routing</label>
        <label className="flex items-center gap-2 text-sm"><Checkbox checked={failover} onCheckedChange={(checked) => setFailover(Boolean(checked))} /> Failover enabled</label>
        <Button className="w-full" onClick={() => create.mutate()} disabled={!selected.length || create.isPending}>Create pool</Button>
      </div>
    </section>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <div className="space-y-2"><Label>{label}</Label>{children}</div>;
}

function Picker({ value, onValueChange, items, placeholder }: { value: string; onValueChange: (value: string) => void; items: Conn[]; placeholder?: string }) {
  return (
    <Select value={value || undefined} onValueChange={onValueChange}>
      <SelectTrigger><SelectValue placeholder={placeholder ?? "Select"} /></SelectTrigger>
      <SelectContent>
        {items.map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}
