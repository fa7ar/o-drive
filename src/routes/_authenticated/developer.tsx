import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, KeyRound, Plus, RefreshCw, ShieldOff, Webhook } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/app-shell";
import { DeveloperDocs } from "@/components/developer-docs";
import { EmptyState } from "@/components/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  API_SCOPES,
  createApiKey,
  deleteApiKey,
  revokeApiKey,
  rotateApiKey,
} from "@/core/api-keys";
import { summariseUsage } from "@/core/api-usage";
import { createWebhook, deleteWebhook, retryDelivery, WEBHOOK_EVENTS } from "@/core/webhooks";
import type { ApiScope, WebhookEventType } from "@/core/types";
import { formatDateTime } from "@/lib/format";
import {
  apiKeysQuery,
  apiRequestLogsQuery,
  webhookDeliveriesQuery,
  webhooksQuery,
} from "@/lib/queries";

export const Route = createFileRoute("/_authenticated/developer")({
  head: () => ({
    meta: [
      { title: "Developer platform — ODrive" },
      {
        name: "description",
        content:
          "Issue scoped API keys, register signed webhooks and monitor traffic for the provider-agnostic ODrive v1 REST API.",
      },
      { property: "og:title", content: "Developer platform — ODrive" },
      {
        property: "og:description",
        content: "Scoped API keys, signed webhooks and live usage for the ODrive v1 API.",
      },
    ],
  }),
  component: DeveloperPage,
});

const copy = (value: string, label: string) => {
  void navigator.clipboard.writeText(value);
  toast.success(`${label} copied`);
};

function DeveloperPage() {
  const queryClient = useQueryClient();
  const keys = useQuery(apiKeysQuery);
  const hooks = useQuery(webhooksQuery);
  const deliveries = useQuery(webhookDeliveriesQuery);
  const logs = useQuery(apiRequestLogsQuery);

  const [revealed, setRevealed] = useState<{ label: string; secret: string } | null>(null);
  const [name, setName] = useState("");
  const [scopes, setScopes] = useState<ApiScope[]>(["drive:read", "file:read"]);
  const [keyOpen, setKeyOpen] = useState(false);
  const [hookUrl, setHookUrl] = useState("");
  const [hookEvents, setHookEvents] = useState<WebhookEventType[]>(["file.created"]);
  const [hookOpen, setHookOpen] = useState(false);

  const invalidate = (key: string) => queryClient.invalidateQueries({ queryKey: [key] });

  const create = useMutation({
    mutationFn: () => createApiKey({ name, scopes }),
    onSuccess: ({ key, secret }) => {
      invalidate("api-keys");
      setKeyOpen(false);
      setName("");
      setRevealed({ label: key.name, secret });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const rotate = useMutation({
    mutationFn: rotateApiKey,
    onSuccess: ({ key, secret }) => {
      invalidate("api-keys");
      setRevealed({ label: `${key.name} (rotated)`, secret });
    },
  });

  const revoke = useMutation({
    mutationFn: revokeApiKey,
    onSuccess: () => {
      invalidate("api-keys");
      toast.success("Key revoked");
    },
  });

  const remove = useMutation({
    mutationFn: deleteApiKey,
    onSuccess: () => {
      invalidate("api-keys");
      toast.success("Key deleted");
    },
  });

  const addHook = useMutation({
    mutationFn: () => createWebhook({ url: hookUrl, events: hookEvents }),
    onSuccess: ({ secret }) => {
      invalidate("webhooks");
      setHookOpen(false);
      setHookUrl("");
      setRevealed({ label: "Webhook signing secret", secret });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const dropHook = useMutation({
    mutationFn: deleteWebhook,
    onSuccess: () => {
      invalidate("webhooks");
      toast.success("Endpoint removed");
    },
  });

  const retry = useMutation({
    mutationFn: retryDelivery,
    onSuccess: () => {
      invalidate("webhook-deliveries");
      toast.success("Delivery retried");
    },
  });

  const usage = summariseUsage(logs.data ?? []);
  
  // Get current domain dynamically
  const currentDomain = typeof window !== 'undefined' 
    ? window.location.origin 
    : 'https://odrive.plab.workers.dev';

  return (
    <AppShell
      title="Developer platform"
      description="One REST contract over Google Drive, OneDrive, S3, R2 and Telegram. Keys are scoped, secrets are hashed and every request is logged."
      actions={
        <Button variant="outline" asChild>
          <a href="/api/public/v1/openapi.json" target="_blank" rel="noreferrer">
            OpenAPI spec
          </a>
        </Button>
      }
    >
      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        {[
          { label: "Requests (recent)", value: usage.total },
          { label: "Error rate", value: `${usage.errorRate}%` },
          { label: "p95 latency", value: `${usage.p95DurationMs} ms` },
        ].map((stat) => (
          <Card key={stat.label}>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">{stat.label}</p>
              <p className="mt-1 text-2xl font-semibold">{stat.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="keys">
        <TabsList>
          <TabsTrigger value="keys">API keys</TabsTrigger>
          <TabsTrigger value="webhooks">Webhooks</TabsTrigger>
          <TabsTrigger value="usage">Usage</TabsTrigger>
          <TabsTrigger value="quickstart">Quickstart</TabsTrigger>
        </TabsList>

        {/* ------------------------------- keys ------------------------------ */}
        <TabsContent value="keys" className="mt-4 space-y-3">
          <Dialog open={keyOpen} onOpenChange={setKeyOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="size-4" /> New API key
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create API key</DialogTitle>
                <DialogDescription>
                  The secret is shown once. Grant only the scopes the integration needs.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="key-name">Name</Label>
                  <Input
                    id="key-name"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder="Backup worker"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Scopes</Label>
                  <div className="space-y-2 rounded-lg border border-border p-3">
                    {API_SCOPES.map((entry) => (
                      <label key={entry.scope} className="flex items-start gap-3 text-sm">
                        <Checkbox
                          checked={scopes.includes(entry.scope)}
                          onCheckedChange={(checked) =>
                            setScopes((current) =>
                              checked
                                ? [...current, entry.scope]
                                : current.filter((scope) => scope !== entry.scope),
                            )
                          }
                        />
                        <span>
                          <code className="text-xs">{entry.scope}</code>
                          <span className="block text-xs text-muted-foreground">
                            {entry.description}
                          </span>
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button onClick={() => create.mutate()} disabled={create.isPending}>
                  Create key
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {(keys.data ?? []).length === 0 ? (
            <EmptyState
              icon={<KeyRound className="size-5" />}
              title="No API keys yet"
              description="Create a scoped key to call the ODrive v1 API from your own services."
            />
          ) : (
            <div className="divide-y divide-border rounded-lg border border-border bg-card">
              {(keys.data ?? []).map((key) => (
                <div key={key.id} className="flex flex-wrap items-center gap-3 p-4">
                  <div className="min-w-48 flex-1">
                    <p className="font-medium">{key.name}</p>
                    <p className="font-mono text-xs text-muted-foreground">{key.prefix}…</p>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {key.scopes.map((scope) => (
                      <Badge key={scope} variant="secondary" className="text-[10px]">
                        {scope}
                      </Badge>
                    ))}
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {key.lastUsedAt ? `Used ${formatDateTime(key.lastUsedAt)}` : "Never used"}
                  </span>
                  <Badge variant={key.status === "active" ? "default" : "secondary"}>
                    {key.status}
                  </Badge>
                  <div className="ml-auto flex gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => rotate.mutate(key.id)}
                      aria-label="Rotate key"
                    >
                      <RefreshCw className="size-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => revoke.mutate(key.id)}
                      disabled={key.status !== "active"}
                      aria-label="Revoke key"
                    >
                      <ShieldOff className="size-4" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => remove.mutate(key.id)}>
                      Delete
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ----------------------------- webhooks ---------------------------- */}
        <TabsContent value="webhooks" className="mt-4 space-y-3">
          <Dialog open={hookOpen} onOpenChange={setHookOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="size-4" /> Add endpoint
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Register webhook endpoint</DialogTitle>
                <DialogDescription>
                  Payloads are ODrive-shaped and signed with HMAC-SHA256 over{" "}
                  <code>timestamp.body</code>.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="hook-url">Endpoint URL</Label>
                  <Input
                    id="hook-url"
                    value={hookUrl}
                    onChange={(event) => setHookUrl(event.target.value)}
                    placeholder="https://example.com/hooks/odrive"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Events</Label>
                  <div className="grid grid-cols-2 gap-2 rounded-lg border border-border p-3">
                    {WEBHOOK_EVENTS.map((event) => (
                      <label key={event} className="flex items-center gap-2 text-sm">
                        <Checkbox
                          checked={hookEvents.includes(event)}
                          onCheckedChange={(checked) =>
                            setHookEvents((current) =>
                              checked
                                ? [...current, event]
                                : current.filter((item) => item !== event),
                            )
                          }
                        />
                        <code className="text-xs">{event}</code>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button onClick={() => addHook.mutate()} disabled={addHook.isPending}>
                  Register
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {(hooks.data ?? []).length === 0 ? (
            <EmptyState
              icon={<Webhook className="size-5" />}
              title="No webhook endpoints"
              description="Subscribe to file, transfer, drive and share events with signed deliveries and retries."
            />
          ) : (
            <div className="divide-y divide-border rounded-lg border border-border bg-card">
              {(hooks.data ?? []).map((endpoint) => (
                <div key={endpoint.id} className="flex flex-wrap items-center gap-3 p-4">
                  <div className="min-w-56 flex-1">
                    <p className="truncate font-medium">{endpoint.url}</p>
                    <p className="text-xs text-muted-foreground">
                      {endpoint.events.join(", ")} · {endpoint.secretMasked}
                    </p>
                  </div>
                  <Badge variant={endpoint.status === "active" ? "default" : "secondary"}>
                    {endpoint.status}
                  </Badge>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="ml-auto"
                    onClick={() => dropHook.mutate(endpoint.id)}
                  >
                    Remove
                  </Button>
                </div>
              ))}
            </div>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Recent deliveries</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {(deliveries.data ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground">No deliveries yet.</p>
              ) : (
                (deliveries.data ?? []).map((delivery) => (
                  <div
                    key={delivery.id}
                    className="flex items-center gap-3 rounded-md border border-border px-3 py-2 text-sm"
                  >
                    <code className="text-xs">{delivery.event}</code>
                    <span className="text-xs text-muted-foreground">{delivery.eventId}</span>
                    <Badge
                      variant={delivery.status === "delivered" ? "default" : "secondary"}
                      className="ml-auto"
                    >
                      {delivery.status} · attempt {delivery.attempt}
                    </Badge>
                    <Button size="sm" variant="ghost" onClick={() => retry.mutate(delivery.id)}>
                      Retry
                    </Button>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ------------------------------ usage ----------------------------- */}
        <TabsContent value="usage" className="mt-4">
          <div className="overflow-hidden rounded-lg border border-border bg-card">
            <table className="w-full text-sm">
              <thead className="bg-surface text-left text-xs text-muted-foreground">
                <tr>
                  <th className="p-3">When</th>
                  <th className="p-3">Method</th>
                  <th className="p-3">Path</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Duration</th>
                  <th className="p-3">Request id</th>
                </tr>
              </thead>
              <tbody>
                {(logs.data ?? []).length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-6 text-center text-muted-foreground">
                      No API traffic recorded yet.
                    </td>
                  </tr>
                ) : (
                  (logs.data ?? []).map((row) => (
                    <tr key={row.id} className="border-t border-border">
                      <td className="p-3 text-muted-foreground">{formatDateTime(row.createdAt)}</td>
                      <td className="p-3 font-mono text-xs">{row.method}</td>
                      <td className="p-3 font-mono text-xs">{row.path}</td>
                      <td className="p-3">
                        <Badge variant={row.status < 400 ? "default" : "destructive"}>
                          {row.status}
                        </Badge>
                      </td>
                      <td className="p-3">{row.durationMs} ms</td>
                      <td className="p-3 font-mono text-xs text-muted-foreground">
                        {row.requestId}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </TabsContent>

        {/* ---------------------------- quickstart -------------------------- */}
        <TabsContent value="quickstart" className="mt-4">
          <DeveloperDocs baseUrl={currentDomain} />
        </TabsContent>
      </Tabs>

      <Dialog open={Boolean(revealed)} onOpenChange={(open) => !open && setRevealed(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Copy your secret now</DialogTitle>
            <DialogDescription>
              {revealed?.label} — this value is shown once and is never stored in plaintext.
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center gap-2">
            <code className="flex-1 overflow-x-auto rounded-md bg-surface p-3 text-xs">
              {revealed?.secret}
            </code>
            <Button
              variant="outline"
              onClick={() => revealed && copy(revealed.secret, "Secret")}
              aria-label="Copy secret"
            >
              <Copy className="size-4" />
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
