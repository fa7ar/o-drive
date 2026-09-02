import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { History } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { EmptyState } from "@/components/empty-state";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDateTime } from "@/lib/format";
import { activityFeedQuery } from "@/lib/queries";

export const Route = createFileRoute("/_authenticated/activity")({
  head: () => ({
    meta: [
      { title: "Activity — ODrive audit trail" },
      {
        name: "description",
        content:
          "Every workspace event in one feed: connections, drives, transfers, shares and automation runs.",
      },
      { property: "og:title", content: "Activity — ODrive audit trail" },
      {
        property: "og:description",
        content: "A chronological audit trail of everything that happened in your ODrive workspace.",
      },
    ],
  }),
  component: ActivityPage,
});

function ActivityPage() {
  const [filter, setFilter] = useState("");
  const { data, isPending, isError, refetch } = useQuery(activityFeedQuery);

  const term = filter.trim().toLowerCase();
  const entries = (data ?? []).filter(
    (entry) =>
      !term ||
      entry.action.toLowerCase().includes(term) ||
      entry.target.toLowerCase().includes(term) ||
      entry.actor.toLowerCase().includes(term),
  );

  return (
    <AppShell
      title="Activity"
      description="Chronological audit trail for this workspace. Nothing here leaves your workspace."
      actions={
        <Input
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
          placeholder="Filter by action, target or actor"
          className="h-9 w-64"
          aria-label="Filter activity"
        />
      }
    >
      {isPending ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="h-14 w-full" />
          ))}
        </div>
      ) : isError ? (
        <EmptyState
          icon={<History className="size-6" strokeWidth={1.6} />}
          title="Activity unavailable"
          description="We could not load the audit trail. Try again in a moment."
          action={<Button onClick={() => void refetch()}>Retry</Button>}
        />
      ) : entries.length === 0 ? (
        <EmptyState
          icon={<History className="size-6" strokeWidth={1.6} />}
          title={term ? "No matching events" : "No activity yet"}
          description={
            term
              ? "Nothing matches that filter. Clear it to see the full trail."
              : "Connect a drive or run a transfer and events will appear here."
          }
        />
      ) : (
        <ul className="panel divide-y divide-border">
          {entries.map((entry) => (
            <li key={entry.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <Badge variant="outline" className="font-mono text-[11px]">
                {entry.action}
              </Badge>
              <span className="min-w-0 flex-1 truncate text-sm">{entry.target}</span>
              <span className="text-xs text-muted-foreground">{entry.actor}</span>
              <span className="font-mono text-xs text-muted-foreground">
                {formatDateTime(entry.createdAt)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </AppShell>
  );
}
