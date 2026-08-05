import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/app-shell";
import { ProviderIcon } from "@/components/provider-icon";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { listProviders } from "@/core/registry";
import { toggleFlag, updateSettings } from "@/core/services";
import { useAuth } from "@/hooks/useAuth";
import { flagsQuery, settingsQuery } from "@/lib/queries";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [
      { title: "Settings — ODrive" },
      {
        name: "description",
        content: "Workspace preferences, transfer concurrency and the registered provider adapters.",
      },
      { property: "og:title", content: "Settings — ODrive" },
      {
        property: "og:description",
        content: "Workspace preferences and the registered storage adapters.",
      },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const settings = useQuery(settingsQuery);
  const flags = useQuery(flagsQuery);
  const queryClient = useQueryClient();
  const { user, signOut } = useAuth();
  const [workspaceName, setWorkspaceName] = useState<string | null>(null);
  const providers = listProviders();

  const saveMutation = useMutation({
    mutationFn: (patch: Parameters<typeof updateSettings>[0]) => updateSettings(patch),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings"] });
      toast.success("Settings saved");
    },
  });

  const flagMutation = useMutation({
    mutationFn: ({ key, enabled }: { key: string; enabled: boolean }) => toggleFlag(key, enabled),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["flags"] }),
  });

  const data = settings.data;
  const nameValue = workspaceName ?? data?.workspaceName ?? "";

  return (
    <AppShell title="Settings" description="Workspace preferences and adapter registry.">
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="panel p-5">
          <h2 className="font-display text-sm font-semibold">Workspace</h2>
          <div className="mt-4 space-y-2">
            <Label htmlFor="workspace">Workspace name</Label>
            <Input
              id="workspace"
              value={nameValue}
              onChange={(event) => setWorkspaceName(event.target.value)}
            />
          </div>
          <div className="mt-4 space-y-2">
            <Label htmlFor="concurrency">Concurrent transfers</Label>
            <Input
              id="concurrency"
              type="number"
              min={1}
              max={16}
              value={data?.concurrentTransfers ?? 3}
              onChange={(event) =>
                saveMutation.mutate({ concurrentTransfers: Number(event.target.value) || 1 })
              }
            />
          </div>
          <Button
            className="mt-5"
            disabled={!nameValue.trim() || saveMutation.isPending}
            onClick={() => saveMutation.mutate({ workspaceName: nameValue.trim() })}
          >
            Save workspace
          </Button>
        </section>

        <section className="panel p-5">
          <h2 className="font-display text-sm font-semibold">Security &amp; privacy</h2>
          <div className="mt-4 space-y-4">
            <label className="flex items-center justify-between gap-4">
              <span className="text-sm">
                Require magic-link re-auth
                <span className="block text-xs text-muted-foreground">
                  Ask for a fresh link on every new device.
                </span>
              </span>
              <Switch
                checked={data?.requireMagicLinkReauth ?? false}
                onCheckedChange={(checked) =>
                  saveMutation.mutate({ requireMagicLinkReauth: checked })
                }
              />
            </label>
            <label className="flex items-center justify-between gap-4">
              <span className="text-sm">
                Anonymous telemetry
                <span className="block text-xs text-muted-foreground">
                  Share adapter performance metrics.
                </span>
              </span>
              <Switch
                checked={data?.telemetry ?? false}
                onCheckedChange={(checked) => saveMutation.mutate({ telemetry: checked })}
              />
            </label>
          </div>
          <div className="mt-6 border-t border-border pt-4">
            <p className="text-sm">
              Signed in as <span className="font-medium">{user?.email}</span>
            </p>
            <Button variant="outline" size="sm" className="mt-3" onClick={() => signOut()}>
              Sign out
            </Button>
          </div>
        </section>

        <section className="panel p-5">
          <h2 className="font-display text-sm font-semibold">Registered adapters</h2>
          <ul className="mt-4 space-y-3">
            {providers.map((provider) => (
              <li key={provider.descriptor.id} className="flex items-center gap-3">
                <ProviderIcon
                  icon={provider.descriptor.icon}
                  accent={provider.descriptor.accent}
                  size="sm"
                />
                <div className="min-w-0">
                  <p className="text-sm font-medium">{provider.descriptor.name}</p>
                  <p className="font-mono text-xs text-muted-foreground">
                    {provider.descriptor.id}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section className="panel p-5">
          <h2 className="font-display text-sm font-semibold">Feature flags</h2>
          <ul className="mt-4 space-y-4">
            {(flags.data ?? []).map((flag) => (
              <li key={flag.key} className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-medium">{flag.label}</p>
                  <p className="text-xs text-muted-foreground">{flag.description}</p>
                </div>
                <Switch
                  checked={flag.enabled}
                  onCheckedChange={(checked) =>
                    flagMutation.mutate({ key: flag.key, enabled: checked })
                  }
                />
              </li>
            ))}
          </ul>
        </section>
      </div>
    </AppShell>
  );
}
