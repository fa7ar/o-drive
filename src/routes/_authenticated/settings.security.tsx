import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { KeyRound, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { updateSettings } from "@/core/services";
import { useAuth } from "@/hooks/useAuth";
import { settingsQuery } from "@/lib/queries";

export const Route = createFileRoute("/_authenticated/settings/security")({
  head: () => ({
    meta: [
      { title: "Security — ODrive settings" },
      {
        name: "description",
        content:
          "Sign-in protection, session controls and privacy choices for your ODrive workspace.",
      },
      { property: "og:title", content: "Security — ODrive settings" },
      {
        property: "og:description",
        content: "Sign-in protection, session controls and privacy choices.",
      },
    ],
  }),
  component: SecuritySettingsPage,
});

function SecuritySettingsPage() {
  const settings = useQuery(settingsQuery);
  const queryClient = useQueryClient();
  const { user, signOut } = useAuth();

  const saveMutation = useMutation({
    mutationFn: (patch: Parameters<typeof updateSettings>[0]) => updateSettings(patch),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings"] });
      toast.success("Security settings saved");
    },
  });

  const data = settings.data;

  return (
    <AppShell
      title="Security"
      description="How sign-in, sessions and privacy behave for this workspace."
    >
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="panel p-5">
          <h2 className="font-display text-sm font-semibold">Sign-in protection</h2>
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
            <div className="flex items-start gap-3 rounded-lg border border-border bg-surface p-3">
              <KeyRound className="mt-0.5 size-4 text-muted-foreground" strokeWidth={1.8} />
              <p className="text-xs text-muted-foreground">
                Provider credentials are encrypted before storage and never returned to the
                browser. Adapters receive them only at call time.
              </p>
            </div>
          </div>
        </section>

        <section className="panel p-5">
          <h2 className="font-display text-sm font-semibold">Privacy</h2>
          <div className="mt-4 space-y-4">
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
            <div className="flex items-start gap-3 rounded-lg border border-border bg-surface p-3">
              <ShieldCheck className="mt-0.5 size-4 text-muted-foreground" strokeWidth={1.8} />
              <p className="text-xs text-muted-foreground">
                Share links can carry a password and an expiry date. Access is logged with a
                salted hash, never a raw IP address.
              </p>
            </div>
          </div>
        </section>

        <section className="panel p-5">
          <h2 className="font-display text-sm font-semibold">Session</h2>
          <p className="mt-4 text-sm">
            Signed in as <span className="font-medium">{user?.email}</span>
          </p>
          <Button variant="outline" size="sm" className="mt-3" onClick={() => signOut()}>
            Sign out of this device
          </Button>
        </section>
      </div>
    </AppShell>
  );
}
