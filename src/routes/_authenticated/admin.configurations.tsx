import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { AdminNav } from "@/components/admin-nav";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { setConfig } from "@/core/configurations";
import { configQuery } from "@/lib/queries";

export const Route = createFileRoute("/_authenticated/admin/configurations")({
  head: () => ({
    meta: [
      { title: "Configurations — ODrive admin" },
      { name: "description", content: "Runtime configuration for queue, storage, security and retention." },
      { property: "og:title", content: "Configurations — ODrive admin" },
      { property: "og:description", content: "Queue, storage, security and retention settings." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdminConfigurations,
});

function AdminConfigurations() {
  const config = useQuery(configQuery);
  const queryClient = useQueryClient();
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  const save = useMutation({
    mutationFn: ({ key, value }: { key: string; value: string }) => setConfig(key, value),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["config"] });
      toast.success("Configuration saved");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const sections = Array.from(new Set((config.data ?? []).map((entry) => entry.section)));

  return (
    <AppShell title="Configurations" description="Every value validated and versioned on save.">
      <AdminNav />
      <div className="space-y-4">
        {sections.map((section) => (
          <section key={section} className="panel p-5">
            <h2 className="font-display text-sm font-semibold capitalize">{section}</h2>
            <div className="mt-2">
              {(config.data ?? [])
                .filter((entry) => entry.section === section)
                .map((entry) => (
                  <div
                    key={entry.key}
                    className="grid gap-2 border-t border-border py-3 md:grid-cols-[1fr_auto] md:items-end"
                  >
                    <div>
                      <Label htmlFor={entry.key} className="text-xs">
                        {entry.label}
                      </Label>
                      <p className="font-mono text-[11px] text-muted-foreground">{entry.key}</p>
                      {entry.description ? (
                        <p className="mt-1 text-xs text-muted-foreground">{entry.description}</p>
                      ) : null}
                    </div>
                    <div className="flex items-center gap-2">
                      <Input
                        id={entry.key}
                        className="h-8 max-w-48"
                        value={drafts[entry.key] ?? String(entry.value)}
                        onChange={(event) =>
                          setDrafts((previous) => ({ ...previous, [entry.key]: event.target.value }))
                        }
                      />
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() =>
                          save.mutate({ key: entry.key, value: drafts[entry.key] ?? String(entry.value) })
                        }
                      >
                        Save
                      </Button>
                    </div>
                  </div>
                ))}
            </div>
          </section>
        ))}
      </div>
    </AppShell>
  );
}
