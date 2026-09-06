import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ChevronRight,
  Clock,
  FileText,
  Folder,
  Grid2x2,
  Image as ImageIcon,
  List,
  MoreHorizontal,
  Search,
  Star,
  Trash2,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";

import { AppShell } from "@/components/app-shell";
import { EmptyState } from "@/components/empty-state";
import { FileTypeIcon } from "@/components/file-type-icon";
import { ProviderIcon } from "@/components/provider-icon";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { documentLabel, matchesCategoryFilter, type DocumentCategory } from "@/core/documents";
import { tryGetProvider } from "@/core/registry";
import { queueTransfer, toggleFavorite, trashFile } from "@/core/services";
import type { FileMetadata } from "@/core/types";
import { formatBytes, formatDateTime } from "@/lib/format";
import { ShareDialog, type ShareTarget } from "@/components/share-dialog";
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
          "Browse, filter and sort every document across all connected providers from one unified file tree.",
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

type Scope = "browse" | "recent" | "favorites" | "documents" | "images" | "trash";
type SortKey = "name" | "modified" | "size" | "type";

const VIEWS: Array<{ key: Scope; label: string; icon: typeof Folder }> = [
  { key: "browse", label: "All files", icon: Folder },
  { key: "recent", label: "Recent", icon: Clock },
  { key: "favorites", label: "Favorites", icon: Star },
  { key: "documents", label: "Documents", icon: FileText },
  { key: "images", label: "Images", icon: ImageIcon },
  { key: "trash", label: "Trash", icon: Trash2 },
];

const CATEGORIES: Array<{ key: DocumentCategory | "all"; label: string }> = [
  { key: "all", label: "All types" },
  { key: "document", label: "Documents" },
  { key: "image", label: "Images" },
  { key: "video", label: "Video" },
  { key: "audio", label: "Audio" },
  { key: "archive", label: "Archives" },
  { key: "other", label: "Other" },
];

const VIEW_PREF_KEY = "odrive.explorer.view";

function ExplorerPage() {
  const { q } = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const queryClient = useQueryClient();

  const drives = useQuery(drivesQuery);
  const [shareTarget, setShareTarget] = useState<ShareTarget | null>(null);
  const activeDrives = (drives.data ?? []).filter(
    (view) => view.drive.status === "active" && view.connection.status === "connected",
  );
  const connected = activeDrives.map((view) => view.connection);
  const files = useQuery(filesQuery(connected.map((c) => c.id)));

  const [scope, setScope] = useState<Scope>("browse");
  const [path, setPath] = useState("/");
  const [view, setView] = useState<"grid" | "list">("list");
  const [sort, setSort] = useState<SortKey>("name");
  const [category, setCategory] = useState<DocumentCategory | "all">("all");
  const [driveFilter, setDriveFilter] = useState<string>("all");
  const query = q ?? "";

  // Remember the layout preference between visits (read after hydration).
  useEffect(() => {
    const stored = window.localStorage.getItem(VIEW_PREF_KEY);
    if (stored === "grid" || stored === "list") setView(stored);
  }, []);

  function changeView(next: "grid" | "list") {
    setView(next);
    window.localStorage.setItem(VIEW_PREF_KEY, next);
  }

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
      list = list.filter(
        (f) =>
          !f.trashed &&
          (f.name.toLowerCase().includes(needle) ||
            (f.tags ?? []).some((tag) => tag.includes(needle))),
      );
    } else if (scope === "browse") {
      list = list.filter((f) => f.path === path && !f.trashed);
    } else if (scope === "favorites") {
      list = list.filter((f) => f.favorite && !f.trashed);
    } else if (scope === "trash") {
      list = list.filter((f) => f.trashed);
    } else if (scope === "documents") {
      list = list.filter((f) => !f.trashed && matchesCategoryFilter(f, "document"));
    } else if (scope === "images") {
      list = list.filter((f) => !f.trashed && matchesCategoryFilter(f, "image"));
    } else {
      list = [...list]
        .filter((f) => !f.trashed && f.kind === "file")
        .sort((a, b) =>
          (b.lastOpenedAt ?? b.modifiedAt).localeCompare(a.lastOpenedAt ?? a.modifiedAt),
        )
        .slice(0, 24);
    }

    if (category !== "all") list = list.filter((f) => matchesCategoryFilter(f, category));
    if (driveFilter !== "all") list = list.filter((f) => f.connectionId === driveFilter);

    const sorted = [...list].sort((a, b) => {
      if (a.kind !== b.kind) return a.kind === "folder" ? -1 : 1;
      if (sort === "modified") return b.modifiedAt.localeCompare(a.modifiedAt);
      if (sort === "size") return b.sizeBytes - a.sizeBytes;
      if (sort === "type") return documentLabel(a).localeCompare(documentLabel(b));
      return a.name.localeCompare(b.name);
    });
    // Recent keeps its own ordering.
    return scope === "recent" && !query && sort === "name" ? list : sorted;
  }, [all, category, driveFilter, path, query, scope, sort]);

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

  function open(file: FileMetadata) {
    if (file.kind === "folder") openFolder(file);
    else navigate({ to: "/files/$fileId", params: { fileId: file.id } });
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
          <>
            <DropdownMenuItem
              onSelect={() => navigate({ to: "/files/$fileId", params: { fileId: file.id } })}
            >
              Open details
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => downloadMutation.mutate(file)}>
              Download
            </DropdownMenuItem>
          </>
        ) : null}
        <DropdownMenuItem
          onSelect={() => {
            const view = activeDrives.find((entry) => entry.connection.id === file.connectionId);
            if (!view) return;
            setShareTarget({
              driveId: view.drive.id,
              driveName: view.drive.name,
              resourceId: file.id,
              resourceName: file.name,
              resourceType: file.kind === "folder" ? "folder" : "file",
            });
          }}
        >
          Share
        </DropdownMenuItem>
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
      description="Every document across every connected drive, in one place."
      actions={
        <Tabs value={view} onValueChange={(value) => changeView(value as "grid" | "list")}>
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
          <nav className="panel p-2" aria-label="Smart views">
            {VIEWS.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => {
                  setScope(item.key);
                  setPath("/");
                  navigate({ search: {} });
                }}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-accent",
                  scope === item.key && !query
                    ? "bg-accent font-medium text-accent-foreground"
                    : "text-muted-foreground",
                )}
              >
                <item.icon className="size-4" strokeWidth={1.8} />
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
                onChange={(event) => navigate({ search: { q: event.target.value || undefined } })}
                placeholder="Search names and tags across every drive"
                className="pl-9"
                aria-label="Search files"
              />
            </div>

            <Select
              value={category}
              onValueChange={(value) => setCategory(value as DocumentCategory | "all")}
            >
              <SelectTrigger className="w-36" aria-label="Filter by type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((item) => (
                  <SelectItem key={item.key} value={item.key}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={driveFilter} onValueChange={setDriveFilter}>
              <SelectTrigger className="w-40" aria-label="Filter by drive">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All drives</SelectItem>
                {activeDrives.map((entry) => (
                  <SelectItem key={entry.connection.id} value={entry.connection.id}>
                    {entry.drive.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={sort} onValueChange={(value) => setSort(value as SortKey)}>
              <SelectTrigger className="w-36" aria-label="Sort files">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="name">Name</SelectItem>
                <SelectItem value="modified">Last modified</SelectItem>
                <SelectItem value="size">Size</SelectItem>
                <SelectItem value="type">Type</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {!query && scope === "browse" ? (
            <div className="mb-3 flex items-center gap-1 text-sm text-muted-foreground">
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
              title={query ? `No matches for “${query}”` : "Nothing here yet"}
              description="Try another folder or filter, or upload from the Transfers page."
            />
          ) : view === "list" ? (
            <div className="panel divide-y divide-border">
              {visible.map((file) => (
                <div key={file.id} className="flex items-center gap-3 px-4 py-3">
                  <FileTypeIcon file={file} className="size-4 shrink-0" />
                  <button
                    type="button"
                    className="min-w-0 flex-1 text-left"
                    onClick={() => open(file)}
                  >
                    <span className="flex items-center gap-2">
                      <span className="truncate text-sm font-medium">{file.name}</span>
                      {file.favorite ? <Star className="size-3.5 fill-warning text-warning" /> : null}
                      {file.trashed ? <Trash2 className="size-3.5 text-muted-foreground" /> : null}
                      {(file.tags ?? []).slice(0, 2).map((tag) => (
                        <Badge key={tag} variant="secondary" className="px-1.5 py-0 text-[10px]">
                          #{tag}
                        </Badge>
                      ))}
                    </span>
                    <span className="mt-0.5 block">{connectionBadge(file.connectionId)}</span>
                  </button>
                  <span className="hidden w-28 text-xs text-muted-foreground lg:block">
                    {documentLabel(file)}
                  </span>
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
                    <FileTypeIcon file={file} className="size-5" />
                    {rowActions(file)}
                  </div>
                  <button
                    type="button"
                    className="mt-3 block w-full text-left"
                    onClick={() => open(file)}
                  >
                    <p className="truncate text-sm font-medium">{file.name}</p>
                    <p className="mt-1 font-mono text-xs text-muted-foreground">
                      {documentLabel(file)}
                      {file.kind === "file" ? ` · ${formatBytes(file.sizeBytes)}` : ""}
                    </p>
                  </button>
                  <div className="mt-3">{connectionBadge(file.connectionId)}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      <ShareDialog
        target={shareTarget}
        open={shareTarget !== null}
        onOpenChange={(open) => {
          if (!open) setShareTarget(null);
        }}
      />
    </AppShell>
  );
}
