import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ChevronRight,
  File as FileIcon,
  Folder,
  Grid2x2,
  List,
  MoreHorizontal,
  Search,
  Star,
  Trash2,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";

import { AppShell } from "@/components/app-shell";
import { EmptyState } from "@/components/empty-state";
import { ProviderIcon } from "@/components/provider-icon";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { tryGetProvider } from "@/core/registry";
import { queueTransfer, toggleFavorite, trashFile } from "@/core/services";
import type { FileMetadata } from "@/core/types";
import { formatBytes, formatDateTime } from "@/lib/format";
import { drivesQuery, filesQuery } from "@/lib/queries";
import { cn } from "@/lib/utils";

const searchSchema = z.object({ q: z.string().optional() });

export const Route = createFileRoute("/_authenticated/explorer")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Explorer — ODrive" },
      {
        name: "description",
        content:
          "Browse folders, favorites and trash across every connected provider from one unified file tree.",
      },
      { property: "og:title", content: "Explorer — ODrive" },
      {
        property: "og:description",
        content: "One unified file tree spanning every connected storage provider.",
      },
    ],
  }),
  component: ExplorerPage,
});

type Scope = "browse" | "recent" | "favorites" | "trash";

function ExplorerPage() {
  const { q } = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const queryClient = useQueryClient();

  const drives = useQuery(drivesQuery);
  const activeDrives = (drives.data ?? []).filter(
    (view) => view.drive.status === "active" && view.connection.status === "connected",
  );
  const connected = activeDrives.map((view) => view.connection);
  const files = useQuery(filesQuery(connected.map((c) => c.id)));

  const [scope, setScope] = useState<Scope>("browse");
  const [path, setPath] = useState("/");
  const [view, setView] = useState<"grid" | "list">("list");
  const query = q ?? "";

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["files"] });

  const favoriteMutation = useMutation({
    mutationFn: ({ id, favorite }: { id: string; favorite: boolean }) => toggleFavorite(id, favorite),
    onSuccess: invalidate,
  });

  const trashMutation = useMutation({
    mutationFn: ({ id, trashed }: { id: string; trashed: boolean }) => trashFile(id, trashed),
    onSuccess: () => {
      invalidate();
      toast.success("Moved to trash");
    },
  });

  const downloadMutation = useMutation({
    mutationFn: (file: FileMetadata) =>
      queueTransfer({
        connectionId: file.connectionId,
        fileName: file.name,
        direction: "download",
        sizeBytes: file.sizeBytes,
      }),
    onSuccess: (job) => {
      queryClient.invalidateQueries({ queryKey: ["transfers"] });
      toast.success("Download queued", { description: job.fileName });
    },
  });

  const all = files.data ?? [];

  const visible = useMemo(() => {
    let list = all;
    if (query) {
      const needle = query.toLowerCase();
      list = list.filter((f) => !f.trashed && f.name.toLowerCase().includes(needle));
    } else if (scope === "browse") {
      list = list.filter((f) => f.path === path && !f.trashed);
    } else if (scope === "favorites") {
      list = list.filter((f) => f.favorite && !f.trashed);
    } else if (scope === "trash") {
      list = list.filter((f) => f.trashed);
    } else {
      list = [...list]
        .filter((f) => !f.trashed && f.kind === "file")
        .sort((a, b) => b.modifiedAt.localeCompare(a.modifiedAt))
        .slice(0, 12);
    }
    return [...list].sort((a, b) =>
      a.kind === b.kind ? a.name.localeCompare(b.name) : a.kind === "folder" ? -1 : 1,
    );
  }, [all, path, query, scope]);

  const segments = path.split("/").filter(Boolean);

  function connectionBadge(connectionId: string) {
    const view = activeDrives.find((entry) => entry.connection.id === connectionId);
    const connection = view?.connection;
    const descriptor = connection ? tryGetProvider(connection.providerId)?.descriptor : undefined;
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
        <ProviderIcon
          icon={descriptor?.icon ?? "Cloud"}
          accent={descriptor?.accent ?? "provider-r2"}
          size="sm"
          className="size-5 rounded"
        />
        {view?.drive.name ?? connection?.name ?? "unknown"}
      </span>
    );
  }

  function openFolder(file: FileMetadata) {
    setScope("browse");
    navigate({ search: {} });
    setPath(`${file.path === "/" ? "" : file.path}/${file.name}`);
  }

  const rowActions = (file: FileMetadata) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={`Actions for ${file.name}`}>
          <MoreHorizontal className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {file.kind === "file" ? (
          <DropdownMenuItem onSelect={() => downloadMutation.mutate(file)}>
            Download
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuItem
          onSelect={() => favoriteMutation.mutate({ id: file.id, favorite: !file.favorite })}
        >
          {file.favorite ? "Remove favorite" : "Add favorite"}
        </DropdownMenuItem>
        <DropdownMenuItem
          className="text-destructive"
          onSelect={() => trashMutation.mutate({ id: file.id, trashed: !file.trashed })}
        >
          {file.trashed ? "Restore" : "Move to trash"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  return (
    <AppShell
      title="Explorer"
      description="A unified tree across every connected provider. Mock data via the adapter layer."
      actions={
        <Tabs value={view} onValueChange={(value) => setView(value as "grid" | "list")}>
          <TabsList>
            <TabsTrigger value="list" aria-label="List view">
              <List className="size-4" />
            </TabsTrigger>
            <TabsTrigger value="grid" aria-label="Grid view">
              <Grid2x2 className="size-4" />
            </TabsTrigger>
          </TabsList>
        </Tabs>
      }
    >
      <div className="flex flex-col gap-4 lg:flex-row">
        <div className="lg:w-48">
          <nav className="panel p-2">
            {(
              [
                { key: "browse", label: "All files" },
                { key: "recent", label: "Recent" },
                { key: "favorites", label: "Favorites" },
                { key: "trash", label: "Trash" },
              ] as const
            ).map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => {
                  setScope(item.key);
                  setPath("/");
                  navigate({ search: {} });
                }}
                className={cn(
                  "block w-full rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-accent",
                  scope === item.key && !query
                    ? "bg-accent font-medium text-accent-foreground"
                    : "text-muted-foreground",
                )}
              >
                {item.label}
              </button>
            ))}
          </nav>
        </div>

        <div className="min-w-0 flex-1">
          <div className="panel mb-4 flex flex-wrap items-center gap-3 p-3">
            <div className="relative min-w-56 flex-1">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(event) =>
                  navigate({ search: { q: event.target.value || undefined } })
                }
                placeholder="Search files across every drive"
                className="pl-9"
                aria-label="Search files"
              />
            </div>
            {!query && scope === "browse" ? (
              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                <button type="button" className="hover:text-foreground" onClick={() => setPath("/")}>
                  root
                </button>
                {segments.map((segment, index) => (
                  <span key={segment} className="flex items-center gap-1">
                    <ChevronRight className="size-3.5" />
                    <button
                      type="button"
                      className="hover:text-foreground"
                      onClick={() => setPath(`/${segments.slice(0, index + 1).join("/")}`)}
                    >
                      {segment}
                    </button>
                  </span>
                ))}
              </div>
            ) : null}
          </div>

          {connected.length === 0 ? (
            <EmptyState
              title="No connected providers"
              description="Connect an account on the Connections page to populate the explorer."
            />
          ) : files.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading files…</p>
          ) : visible.length === 0 ? (
            <EmptyState
              icon={<Folder className="size-6" />}
              title={query ? `No matches for “${query}”` : "This folder is empty"}
              description="Try another folder, or upload from the Transfers page."
            />
          ) : view === "list" ? (
            <div className="panel divide-y divide-border">
              {visible.map((file) => (
                <div key={file.id} className="flex items-center gap-3 px-4 py-3">
                  {file.kind === "folder" ? (
                    <Folder className="size-4 shrink-0 text-primary" strokeWidth={1.8} />
                  ) : (
                    <FileIcon className="size-4 shrink-0 text-muted-foreground" strokeWidth={1.8} />
                  )}
                  <button
                    type="button"
                    className="min-w-0 flex-1 text-left"
                    onClick={() => file.kind === "folder" && openFolder(file)}
                  >
                    <span className="flex items-center gap-2">
                      <span className="truncate text-sm font-medium">{file.name}</span>
                      {file.favorite ? (
                        <Star className="size-3.5 fill-warning text-warning" />
                      ) : null}
                      {file.trashed ? <Trash2 className="size-3.5 text-muted-foreground" /> : null}
                    </span>
                    <span className="mt-0.5 block">{connectionBadge(file.connectionId)}</span>
                  </button>
                  <span className="hidden font-mono text-xs text-muted-foreground sm:block">
                    {file.kind === "folder" ? "—" : formatBytes(file.sizeBytes)}
                  </span>
                  <span className="hidden text-xs text-muted-foreground md:block">
                    {formatDateTime(file.modifiedAt)}
                  </span>
                  {rowActions(file)}
                </div>
              ))}
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {visible.map((file) => (
                <div key={file.id} className="panel p-4">
                  <div className="flex items-start justify-between">
                    {file.kind === "folder" ? (
                      <Folder className="size-5 text-primary" strokeWidth={1.8} />
                    ) : (
                      <FileIcon className="size-5 text-muted-foreground" strokeWidth={1.8} />
                    )}
                    {rowActions(file)}
                  </div>
                  <button
                    type="button"
                    className="mt-3 block w-full text-left"
                    onClick={() => file.kind === "folder" && openFolder(file)}
                  >
                    <p className="truncate text-sm font-medium">{file.name}</p>
                    <p className="mt-1 font-mono text-xs text-muted-foreground">
                      {file.kind === "folder" ? "folder" : formatBytes(file.sizeBytes)}
                    </p>
                  </button>
                  <div className="mt-3">{connectionBadge(file.connectionId)}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
