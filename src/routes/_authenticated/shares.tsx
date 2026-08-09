import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, ExternalLink, Link2, MoreHorizontal, RefreshCw, ShieldOff } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/app-shell";
import { EmptyState } from "@/components/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  deleteShare,
  reactivateShare,
  revokeShare,
  rotateShareToken,
  shareUrl,
} from "@/core/shares";
import type { ShareStatus } from "@/core/types";
import { formatDateTime } from "@/lib/format";
import { sharesQuery } from "@/lib/queries";

export const Route = createFileRoute("/_authenticated/shares")({
  head: () => ({
    meta: [
      { title: "Shares — ODrive" },
      {
        name: "description",
        content:
          "Manage every public and password-protected share link across your drives: expiry, download limits, rotation and revocation.",
      },
      { property: "og:title", content: "Shares — ODrive" },
      {
        property: "og:description",
        content: "Provider-agnostic share links with expiry, download limits and instant revocation.",
      },
    ],
  }),
  component: SharesPage,
});

const STATUS_VARIANT: Record<ShareStatus, string> = {
  active: "bg-success/12 text-success",
  expired: "bg-muted text-muted-foreground",
  revoked: "bg-destructive/12 text-destructive",
  limit_reached: "bg-warning/12 text-warning",
};

function SharesPage() {
  const queryClient = useQueryClient();
  const shares = useQuery(sharesQuery);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["shares"] });

  const revoke = useMutation({
    mutationFn: revokeShare,
    onSuccess: () => {
      invalidate();
      toast.success("Share revoked");
    },
  });
  const reactivate = useMutation({
    mutationFn: reactivateShare,
    onSuccess: () => {
      invalidate();
      toast.success("Share re-enabled");
    },
  });
  const rotate = useMutation({
    mutationFn: rotateShareToken,
    onSuccess: (share) => {
      invalidate();
      toast.success("Token rotated", { description: "The previous link no longer resolves." });
      void navigator.clipboard.writeText(shareUrl(share.token));
    },
  });
  const remove = useMutation({
    mutationFn: deleteShare,
    onSuccess: () => {
      invalidate();
      toast.success("Share deleted");
    },
  });

  const rows = shares.data ?? [];

  return (
    <AppShell
      title="Shares"
      description="Every link you have handed out, across every drive and provider."
    >
      {shares.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading shares…</p>
      ) : rows.length === 0 ? (
        <EmptyState
          icon={<Link2 className="size-6" />}
          title="No shares yet"
          description="Open the Explorer, pick a file or folder and choose Share to create a link."
        />
      ) : (
        <div className="panel divide-y divide-border">
          {rows.map(({ share, driveName, accessCount }) => {
            const url = shareUrl(share.token);
            return (
              <div key={share.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 truncate text-sm font-medium">
                    {share.resourceName}
                    <span className="text-xs font-normal text-muted-foreground">
                      {share.resourceType}
                    </span>
                  </p>
                  <p className="mt-0.5 truncate font-mono text-xs text-muted-foreground">
                    /s/{share.token} · {driveName}
                  </p>
                </div>
                <Badge className={STATUS_VARIANT[share.status]} variant="secondary">
                  {share.status.replace("_", " ")}
                </Badge>
                <span className="hidden text-xs text-muted-foreground md:block">
                  {share.shareType === "password_protected" ? "password" : share.shareType}
                </span>
                <span className="hidden text-xs text-muted-foreground lg:block">
                  {share.expiresAt ? `expires ${formatDateTime(share.expiresAt)}` : "no expiry"}
                </span>
                <span className="hidden font-mono text-xs text-muted-foreground sm:block">
                  {share.downloadCount}
                  {share.maxDownloads !== null ? `/${share.maxDownloads}` : ""} dl · {accessCount} hits
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Copy link"
                  onClick={async () => {
                    await navigator.clipboard.writeText(url);
                    toast.success("Link copied");
                  }}
                >
                  <Copy className="size-4" />
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" aria-label={`Actions for ${share.resourceName}`}>
                      <MoreHorizontal className="size-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem asChild>
                      <a href={`/s/${share.token}`} target="_blank" rel="noreferrer">
                        <ExternalLink className="size-4" /> Open link
                      </a>
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => rotate.mutate(share.id)}>
                      <RefreshCw className="size-4" /> Rotate token
                    </DropdownMenuItem>
                    {share.status === "active" ? (
                      <DropdownMenuItem onSelect={() => revoke.mutate(share.id)}>
                        <ShieldOff className="size-4" /> Revoke
                      </DropdownMenuItem>
                    ) : (
                      <DropdownMenuItem onSelect={() => reactivate.mutate(share.id)}>
                        Re-enable
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem
                      className="text-destructive"
                      onSelect={() => remove.mutate(share.id)}
                    >
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            );
          })}
        </div>
      )}
    </AppShell>
  );
}
