import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, FileUp, PlugZap, RefreshCw, ShieldCheck, Unplug } from "lucide-react";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  checkWordPressSite,
  connectWordPressSite,
  disconnectWordPressSite,
  testWordPressConnection,
  type WordPressConnectionTest,
} from "@/core/wordpress";
import { backupSyncQuery, connectionsQuery, wordpressQuery } from "@/lib/queries";
import { formatDateTime } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/wordpress")({
  head: () => ({
    meta: [
      { title: "WordPress — ODrive" },
      { name: "description", content: "Connect WordPress sites through REST API Application Passwords and ODrive Connector APIs." },
      { property: "og:title", content: "WordPress — ODrive" },
      { property: "og:description", content: "WordPress site connections, media workflows and connector contract." },
    ],
  }),
  component: WordPressPage,
});

function WordPressPage() {
  const queryClient = useQueryClient();
  const wordpress = useQuery(wordpressQuery);
  const backupSync = useQuery(backupSyncQuery);
  const connections = useQuery(connectionsQuery);
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["wordpress"] });

  const health = useMutation({
    mutationFn: (siteId: string) => checkWordPressSite(siteId),
    onSuccess: () => {
      invalidate();
      toast.success("WordPress health check complete");
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const disconnect = useMutation({
    mutationFn: (siteId: string) => disconnectWordPressSite(siteId),
    onSuccess: () => {
      invalidate();
      toast.success("WordPress site disconnected");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const sites = wordpress.data?.sites ?? [];
  return (
    <AppShell title="WordPress" description="External site integration for Media Library and connector plugin workflows.">
      <div className="grid gap-3 md:grid-cols-4">
        <Metric label="Sites" value={String(sites.length)} />
        <Metric label="Healthy" value={String(sites.filter((site) => site.status === "healthy").length)} />
        <Metric label="Advanced ready" value={String(sites.filter((site) => site.mode === "advanced").length)} />
        <Metric label="Storage pools" value={String(backupSync.data?.pools.length ?? 0)} />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
        <section className="panel">
          <header className="border-b border-border px-4 py-3">
            <h2 className="font-display text-sm font-semibold">Sites</h2>
          </header>
          {sites.length ? (
            <div className="divide-y divide-border">
              {sites.map((site) => (
                <div key={site.id} className="flex flex-wrap items-start gap-3 px-4 py-3">
                  <div className="min-w-56 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium">{site.name}</p>
                      <Badge variant="outline" className={site.status === "healthy" ? "border-success/30 bg-success/10 text-success" : ""}>{site.status}</Badge>
                      <Badge variant="outline">{site.mode}</Badge>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{site.siteUrl} · user {site.username}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Health: {site.lastHealthCheckAt ? formatDateTime(site.lastHealthCheckAt) : "never"} · Backup: {site.lastBackupAt ? formatDateTime(site.lastBackupAt) : "not run"}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {site.capabilities.slice(0, 6).map((capability) => (
                        <span key={capability} className="rounded border border-border bg-surface px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">{capability}</span>
                      ))}
                    </div>
                    {site.lastError ? <p className="mt-2 text-xs text-destructive">{site.lastError}</p> : null}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="secondary" onClick={() => health.mutate(site.id)} disabled={health.isPending}>
                      <RefreshCw className="size-3.5" /> Check
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => disconnect.mutate(site.id)} disabled={disconnect.isPending || site.status === "disconnected"}>
                      <Unplug className="size-3.5" /> Disconnect
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">No WordPress site connected yet.</p>
          )}
        </section>

        <ConnectWordPress
          destinations={[
            ...(connections.data ?? []).map((connection) => ({ id: connection.id, name: connection.name, kind: "connection" as const })),
            ...(backupSync.data?.pools ?? []).map((pool) => ({ id: pool.id, name: pool.name, kind: "pool" as const })),
          ]}
          invalidate={invalidate}
        />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <section className="panel p-5">
          <h2 className="font-display text-sm font-semibold">Standard REST capabilities</h2>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {(wordpress.data?.standardCapabilities ?? []).map((capability) => (
              <Capability key={capability.id} label={capability.label} icon="standard" />
            ))}
          </div>
        </section>

        <section className="panel p-5">
          <h2 className="font-display text-sm font-semibold">Connector API contract</h2>
          <p className="mt-1 text-sm text-muted-foreground">Stable endpoints for the separate ODrive Connector WordPress plugin.</p>
          <div className="mt-3 space-y-2">
            {(wordpress.data?.connectorContract.endpoints ?? []).map((endpoint) => (
              <div key={`${endpoint.method}:${endpoint.path}`} className="rounded-md border border-border p-2">
                <p className="font-mono text-xs">{endpoint.method} {endpoint.path}</p>
                <p className="mt-1 text-xs text-muted-foreground">{endpoint.purpose}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </AppShell>
  );
}

function ConnectWordPress({
  destinations,
  invalidate,
}: {
  destinations: Array<{ id: string; name: string; kind: "connection" | "pool" }>;
  invalidate: () => void;
}) {
  const [siteUrl, setSiteUrl] = useState("https://example.com");
  const [username, setUsername] = useState("");
  const [applicationPassword, setApplicationPassword] = useState("");
  const [destination, setDestination] = useState("");
  const [test, setTest] = useState<WordPressConnectionTest | null>(null);
  const selectedDestination = destinations.find((item) => `${item.kind}:${item.id}` === destination);

  const testConnection = useMutation({
    mutationFn: () => testWordPressConnection({ siteUrl, username, applicationPassword }),
    onSuccess: (result) => {
      setTest(result);
      toast[result.ok ? "success" : "error"](result.ok ? "Connection looks valid" : "Connection needs attention");
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const connect = useMutation({
    mutationFn: () => connectWordPressSite({
      siteUrl,
      username,
      applicationPassword,
      mode: "standard",
      backupDestination: selectedDestination ? { kind: selectedDestination.kind, id: selectedDestination.id } : null,
    }),
    onSuccess: () => {
      invalidate();
      setApplicationPassword("");
      toast.success("WordPress site connected");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <section className="panel p-5">
      <h2 className="font-display text-sm font-semibold">Connect site</h2>
      <div className="mt-4 space-y-3">
        <Field label="Site URL"><Input value={siteUrl} onChange={(event) => setSiteUrl(event.target.value)} /></Field>
        <Field label="Username"><Input value={username} onChange={(event) => setUsername(event.target.value)} /></Field>
        <Field label="Application Password"><Input type="password" value={applicationPassword} onChange={(event) => setApplicationPassword(event.target.value)} /></Field>
        <Field label="Backup destination">
          <Select value={destination || undefined} onValueChange={setDestination}>
            <SelectTrigger><SelectValue placeholder="Optional destination" /></SelectTrigger>
            <SelectContent>
              {destinations.map((item) => <SelectItem key={`${item.kind}:${item.id}`} value={`${item.kind}:${item.id}`}>{item.kind}: {item.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </Field>
        <div className="flex gap-2">
          <Button className="flex-1" variant="secondary" onClick={() => testConnection.mutate()} disabled={testConnection.isPending}>
            <ShieldCheck className="size-4" /> Test
          </Button>
          <Button className="flex-1" onClick={() => connect.mutate()} disabled={connect.isPending || !applicationPassword}>
            <PlugZap className="size-4" /> Connect
          </Button>
        </div>
        {test ? (
          <div className="rounded-md border border-border p-3 text-sm">
            <p className={test.ok ? "text-success" : "text-destructive"}>{test.ok ? "Ready to connect" : "Validation failed"}</p>
            <p className="mt-1 font-mono text-xs text-muted-foreground">{test.restUrl || "REST URL unavailable"}</p>
            {[...test.errors, ...test.warnings].map((item) => <p key={item} className="mt-1 text-xs text-muted-foreground">{item}</p>)}
          </div>
        ) : null}
      </div>
    </section>
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

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <div className="space-y-2"><Label>{label}</Label>{children}</div>;
}

function Capability({ label, icon }: { label: string; icon: "standard" | "advanced" }) {
  const Icon = icon === "standard" ? FileUp : CheckCircle2;
  return (
    <div className="flex items-center gap-2 rounded-md border border-border p-2 text-sm">
      <Icon className="size-4 text-primary" />
      <span>{label}</span>
    </div>
  );
}
