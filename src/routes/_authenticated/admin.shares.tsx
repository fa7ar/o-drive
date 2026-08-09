import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link2, ShieldOff } from "lucide-react";
import { toast } from "sonner";

import { AdminNav } from "@/components/admin-nav";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { revokeShare } from "@/core/shares";
import { formatDateTime } from "@/lib/format";
import { allSharesQuery, shareAccessLogsQuery } from "@/lib/queries";

export const Route = createFileRoute("/_authenticated/admin/shares")({
  head: () => ({
    meta: [
      { title: "Share audit — ODrive admin" },
      {
        name: "description",
        content:
          "Workspace-wide audit of every share link: status, access logs, download counts and forced revocation.",
      },
      { property: "og:title", content: "Share audit — ODrive admin" },
      {
        property: "og:description",
        content: "Audit and revoke share links across the whole workspace.",
      },
    ],
  }),
  component: AdminSharesPage,
});

function AdminSharesPage() {
  const queryClient = useQueryClient();
  const shares = useQuery(allSharesQuery);
  const logs = useQuery(shareAccessLogsQuery);

  const revoke = useMutation({
    mutationFn: revokeShare,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["shares"] });
      toast.success("Share revoked");
    },
  });

  const rows = shares.data ?? [];
  const active = rows.filter((row) => row.share.status === "active").length;
  const totalDownloads = rows.reduce((sum, row) => sum + row.share.downloadCount, 0);

  return (
    <div className="space-y-6">
      <AdminNav />

      <section className="grid gap-4 sm:grid-cols-3">
        {[
          { label: "Share links", value: rows.length },
          { label: "Active", value: active },
          { label: "Total downloads", value: totalDownloads },
        ].map((stat) => (
          <div key={stat.label} className="panel p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">{stat.label}</p>
            <p className="mt-1 font-mono text-2xl">{stat.value}</p>
          </div>
        ))}
      </section>

      <section className="panel">
        <header className="flex items-center gap-2 border-b border-border px-4 py-3">
          <Link2 className="size-4 text-primary" />
          <h2 className="text-sm font-semibold">All share links</h2>
        </header>
        <div className="divide-y divide-border">
          {rows.length === 0 ? (
            <p className="px-4 py-6 text-sm text-muted-foreground">No shares in the workspace.</p>
          ) : (
            rows.map(({ share, driveName, accessCount }) => (
              <div key={share.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{share.resourceName}</p>
                  <p className="truncate font-mono text-xs text-muted-foreground">
                    {driveName} · /s/{share.token} · created {formatDateTime(share.createdAt)}
                  </p>
                </div>
                <Badge variant="secondary">{share.status.replace("_", " ")}</Badge>
                <span className="font-mono text-xs text-muted-foreground">
                  {share.downloadCount} dl · {accessCount} hits
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={share.status !== "active"}
                  onClick={() => revoke.mutate(share.id)}
                >
                  <ShieldOff className="size-4" /> Revoke
                </Button>
              </div>
            ))
          )}
        </div>
      </section>

      <section className="panel">
        <header className="border-b border-border px-4 py-3">
          <h2 className="text-sm font-semibold">Access log</h2>
        </header>
        <div className="divide-y divide-border">
          {(logs.data ?? []).length === 0 ? (
            <p className="px-4 py-6 text-sm text-muted-foreground">No access recorded yet.</p>
          ) : (
            (logs.data ?? []).map((entry) => (
              <div
                key={entry.id}
                className="flex flex-wrap items-center gap-3 px-4 py-2.5 font-mono text-xs"
              >
                <span className="text-muted-foreground">{formatDateTime(entry.accessedAt)}</span>
                <span className="uppercase">{entry.action}</span>
                <span
                  className={entry.success ? "text-success" : "text-destructive"}
                >
                  {entry.success ? "ok" : "denied"}
                </span>
                <span className="min-w-0 flex-1 truncate text-muted-foreground">
                  {entry.ipHash} · {entry.userAgent}
                </span>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
