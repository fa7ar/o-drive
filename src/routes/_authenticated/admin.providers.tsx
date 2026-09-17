import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { AdminNav } from "@/components/admin-nav";
import { AppShell } from "@/components/app-shell";
import { ProviderIcon } from "@/components/provider-icon";
import { ReadinessBadge } from "@/components/readiness-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { DESCRIPTORS } from "@/adapters";
import { offlineLevel } from "@/core/health";
import { runHealthChecks, setProviderEnabled } from "@/core/services";
import { formatDateTime } from "@/lib/format";
import { providerStatesQuery, readinessQuery } from "@/lib/queries";

export const Route = createFileRoute("/_authenticated/admin/providers")({
  head: () => ({
    meta: [
      { title: "Providers — ODrive admin" },
      {
        name: "description",
        content: "Enable or disable storage providers, inspect adapter features and run health checks.",
      },
      { property: "og:title", content: "Providers — ODrive admin" },
      { property: "og:description", content: "Provider enablement, features and health checks." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdminProviders,
});

const FEATURES = ["list", "upload", "download", "copy/move", "folders", "quota", "search"];

function AdminProviders() {
  const states = useQuery(providerStatesQuery);
  const readiness = useQuery(readinessQuery);
  const queryClient = useQueryClient();

  const toggle = useMutation({
    mutationFn: ({ providerId, enabled }: { providerId: string; enabled: boolean }) =>
      setProviderEnabled(providerId, enabled),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["provider-states"] }),
  });

  const check = useMutation({
    mutationFn: () => runHealthChecks(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["provider-states"] });
      toast.success("Health checks complete");
    },
  });

  return (
    <AppShell
      title="Providers"
      description="Adapter registry, enablement and health."
      actions={
        <Button size="sm" onClick={() => check.mutate()} disabled={check.isPending}>
          Run health checks
        </Button>
      }
    >
      <AdminNav />
      <div className="space-y-3">
        {DESCRIPTORS.map((descriptor) => {
          const state = states.data?.find((entry) => entry.providerId === descriptor.id);
          const providerReadiness = readiness.data?.groups.providers.find((entry) => entry.id === descriptor.id);
          const level = offlineLevel(state?.checkedAt ?? null, state?.health ?? "unknown");
          return (
            <section key={descriptor.id} className="panel flex flex-wrap items-start gap-4 p-5">
              <ProviderIcon icon={descriptor.icon} accent={descriptor.accent} />
              <div className="min-w-56 flex-1">
                <div className="flex items-center gap-2">
                  <h2 className="font-display text-sm font-semibold">{descriptor.name}</h2>
                  <Badge variant="outline" className="capitalize">
                    {descriptor.capability}
                  </Badge>
                  <ReadinessBadge readiness={providerReadiness?.publicStatus ?? descriptor.readiness} />
                  <Badge
                    variant="outline"
                    className={
                      level === "healthy"
                        ? "border-success/30 bg-success/10 text-success"
                        : level === "warning"
                          ? "border-warning/30 bg-warning/15 text-warning-foreground"
                          : "border-destructive/30 bg-destructive/10 text-destructive"
                    }
                  >
                    {state?.health ?? "unknown"}
                  </Badge>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{descriptor.tagline}</p>
                <p className="mt-2 font-mono text-[11px] text-muted-foreground">
                  auth: {descriptor.authKind} · checked:{" "}
                  {state?.checkedAt ? formatDateTime(state.checkedAt) : "never"}
                </p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {(providerReadiness?.capabilities?.length ? providerReadiness.capabilities.map((item) => `${item.name}: ${item.state}`) : descriptor.verifiedOperations?.length ? descriptor.verifiedOperations : FEATURES).map((feature) => (
                    <span
                      key={feature}
                      className="rounded border border-border bg-surface px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground"
                    >
                      {feature}
                    </span>
                  ))}
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm">
                {state?.enabled ? "Enabled" : "Disabled"}
                <Switch
                  checked={state?.enabled ?? false}
                  onCheckedChange={(checked) =>
                    toggle.mutate({ providerId: descriptor.id, enabled: checked })
                  }
                />
              </label>
            </section>
          );
        })}
      </div>
    </AppShell>
  );
}
