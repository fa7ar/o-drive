import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { AdminNav } from "@/components/admin-nav";
import { AppShell } from "@/components/app-shell";
import { Switch } from "@/components/ui/switch";
import { toggleFlag } from "@/core/services";
import { flagsQuery } from "@/lib/queries";

export const Route = createFileRoute("/_authenticated/admin/flags")({
  head: () => ({
    meta: [
      { title: "Feature flags — ODrive admin" },
      { name: "description", content: "Toggle provider, core and experimental capabilities at runtime." },
      { property: "og:title", content: "Feature flags — ODrive admin" },
      { property: "og:description", content: "Runtime capability toggles per group." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdminFlags,
});

const GROUPS = ["providers", "core", "experimental"] as const;

function AdminFlags() {
  const flags = useQuery(flagsQuery);
  const queryClient = useQueryClient();

  const toggle = useMutation({
    mutationFn: ({ key, enabled }: { key: string; enabled: boolean }) => toggleFlag(key, enabled),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["flags"] }),
  });

  return (
    <AppShell title="Feature flags" description="Capabilities are switched on per group, no deploy needed.">
      <AdminNav />
      <div className="space-y-4">
        {GROUPS.map((group) => (
          <section key={group} className="panel p-5">
            <h2 className="font-display text-sm font-semibold capitalize">{group}</h2>
            <div className="mt-2">
              {(flags.data ?? [])
                .filter((flag) => flag.group === group)
                .map((flag) => (
                  <div
                    key={flag.key}
                    className="flex items-center justify-between gap-4 border-t border-border py-3"
                  >
                    <div>
                      <p className="text-sm font-medium">{flag.label}</p>
                      <p className="font-mono text-[11px] text-muted-foreground">{flag.key}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{flag.description}</p>
                    </div>
                    <Switch
                      checked={flag.enabled}
                      onCheckedChange={(checked) => toggle.mutate({ key: flag.key, enabled: checked })}
                    />
                  </div>
                ))}
            </div>
          </section>
        ))}
      </div>
    </AppShell>
  );
}
