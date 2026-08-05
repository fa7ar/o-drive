import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MoreHorizontal, Plug } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { AddConnectionDialog } from "@/components/add-connection-dialog";
import { AppShell } from "@/components/app-shell";
import { EmptyState } from "@/components/empty-state";
import { ProviderIcon } from "@/components/provider-icon";
import { ConnectionStatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { tryGetProvider } from "@/core/registry";
import { deleteConnection, renameConnection, setConnectionStatus } from "@/core/services";
import type { Connection } from "@/core/types";
import { formatBytes, formatDate } from "@/lib/format";
import { connectionsQuery } from "@/lib/queries";

export const Route = createFileRoute("/_authenticated/connections")({
  head: () => ({
    meta: [
      { title: "Connections — ODrive" },
      {
        name: "description",
        content:
          "Add unlimited provider accounts, connect or disconnect them and rotate sealed credentials.",
      },
      { property: "og:title", content: "Connections — ODrive" },
      {
        property: "og:description",
        content: "Add unlimited provider accounts and manage their status in one table.",
      },
    ],
  }),
  component: ConnectionsPage,
});

function ConnectionsPage() {
  const connections = useQuery(connectionsQuery);
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<Connection | null>(null);
  const [draftName, setDraftName] = useState("");

  const invalidate = () => queryClient.invalidateQueries();

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: Connection["status"] }) =>
      setConnectionStatus(id, status),
    onSuccess: (connection) => {
      invalidate();
      toast.success(`${connection.name} is now ${connection.status}`);
    },
  });

  const renameMutation = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => renameConnection(id, name),
    onSuccess: () => {
      invalidate();
      setEditing(null);
      toast.success("Connection renamed");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteConnection(id),
    onSuccess: () => {
      invalidate();
      toast.success("Connection deleted");
    },
  });

  const rows = connections.data ?? [];

  return (
    <AppShell
      title="Connections"
      description="Every provider account linked to this workspace. Unlimited accounts per provider."
      actions={<AddConnectionDialog />}
    >
      {connections.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading connections…</p>
      ) : rows.length === 0 ? (
        <EmptyState
          icon={<Plug className="size-6" />}
          title="No connections yet"
          description="Link Google Drive, OneDrive, Telegram, R2 or S3 — each goes through the same adapter interface."
          action={<AddConnectionDialog triggerLabel="Add connection" />}
        />
      ) : (
        <div className="panel overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Provider</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Usage</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((connection) => {
                const descriptor = tryGetProvider(connection.providerId)?.descriptor;
                return (
                  <TableRow key={connection.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <ProviderIcon
                          icon={descriptor?.icon ?? "Cloud"}
                          accent={descriptor?.accent ?? "provider-r2"}
                          size="sm"
                        />
                        <span className="text-sm">{descriptor?.name ?? connection.providerId}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <p className="text-sm font-medium">{connection.name}</p>
                      <p className="font-mono text-xs text-muted-foreground">
                        {connection.accountLabel}
                      </p>
                    </TableCell>
                    <TableCell>
                      <ConnectionStatusBadge status={connection.status} />
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {formatBytes(connection.quotaUsedBytes)}
                      {connection.quotaTotalBytes
                        ? ` / ${formatBytes(connection.quotaTotalBytes)}`
                        : " / ∞"}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {formatDate(connection.createdAt)}
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" aria-label="Connection actions">
                            <MoreHorizontal className="size-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {connection.status === "connected" ? (
                            <DropdownMenuItem
                              onSelect={() =>
                                statusMutation.mutate({
                                  id: connection.id,
                                  status: "disconnected",
                                })
                              }
                            >
                              Disconnect
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem
                              onSelect={() =>
                                statusMutation.mutate({ id: connection.id, status: "connected" })
                              }
                            >
                              Connect
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem
                            onSelect={() => {
                              setEditing(connection);
                              setDraftName(connection.name);
                            }}
                          >
                            Edit name
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-destructive"
                            onSelect={() => deleteMutation.mutate(connection.id)}
                          >

                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={Boolean(editing)} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename connection</DialogTitle>
          </DialogHeader>
          <Input value={draftName} onChange={(event) => setDraftName(event.target.value)} />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button
              onClick={() =>
                editing && renameMutation.mutate({ id: editing.id, name: draftName.trim() })
              }
              disabled={!draftName.trim() || renameMutation.isPending}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
