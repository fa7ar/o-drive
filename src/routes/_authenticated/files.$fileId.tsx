import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Download, FileQuestion, Star, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/app-shell";
import { EmptyState } from "@/components/empty-state";
import { FileTypeIcon } from "@/components/file-type-icon";
import { ProviderIcon } from "@/components/provider-icon";
import { ShareDialog, type ShareTarget } from "@/components/share-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { classifyDocument, documentLabel, previewKind } from "@/core/documents";
import { tryGetProvider } from "@/core/registry";
import {
  downloadBlob,
  queueTransfer,
  setFileTags,
  toggleFavorite,
  touchFile,
  trashFile,
} from "@/core/services";
import { formatBytes, formatDateTime } from "@/lib/format";
import { drivesQuery, fileQuery } from "@/lib/queries";

export const Route = createFileRoute("/_authenticated/files/$fileId")({
  head: () => ({
    meta: [
      { title: "File details — ODrive" },
      {
        name: "description",
        content:
          "Preview a document, edit its tags and run actions — identical on every connected provider.",
      },
      { property: "og:title", content: "File details — ODrive" },
      {
        property: "og:description",
        content: "Preview, tag and act on a document from any connected provider.",
      },
    ],
  }),
  component: FileDetailPage,
});

function FileDetailPage() {
  const { fileId } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const file = useQuery(fileQuery(fileId));
  const drives = useQuery(drivesQuery);
  const [shareTarget, setShareTarget] = useState<ShareTarget | null>(null);
  const [tagDraft, setTagDraft] = useState("");

  useEffect(() => {
    if (file.data) void touchFile(file.data.id);
  }, [file.data?.id]);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["files"] });
  };

  const favoriteMutation = useMutation({
    mutationFn: (favorite: boolean) => toggleFavorite(fileId, favorite),
    onSuccess: invalidate,
  });

  const trashMutation = useMutation({
    mutationFn: (trashed: boolean) => trashFile(fileId, trashed),
    onSuccess: () => {
      invalidate();
      toast.success("Moved to trash");
      navigate({ to: "/explorer" });
    },
  });

  const tagMutation = useMutation({
    mutationFn: (tags: string[]) => setFileTags(fileId, tags),
    onSuccess: () => {
      invalidate();
      setTagDraft("");
    },
  });

  const downloadMutation = useMutation({
    mutationFn: () =>
      queueTransfer({
        connectionId: file.data!.connectionId,
        fileName: file.data!.name,
        direction: "download",
        sizeBytes: file.data!.sizeBytes,
      }),
    onSuccess: (job) => {
      queryClient.invalidateQueries({ queryKey: ["transfers"] });
      toast.success("Download queued", { description: job.fileName });
    },
  });

  if (file.isPending) {
    return (
      <AppShell title="File">
        <Skeleton className="h-64 w-full rounded-xl" />
      </AppShell>
    );
  }

  const data = file.data;
  if (!data) {
    return (
      <AppShell title="File">
        <EmptyState
          icon={<FileQuestion className="size-6" />}
          title="This file is no longer in the index"
          description="It may have been deleted or moved on the provider side."
          action={
            <Button asChild variant="outline">
              <Link to="/explorer">Back to Explorer</Link>
            </Button>
          }
        />
      </AppShell>
    );
  }

  const driveView = (drives.data ?? []).find(
    (entry) => entry.connection.id === data.connectionId,
  );
  const descriptor = driveView
    ? tryGetProvider(driveView.connection.providerId)?.descriptor
    : undefined;
  const kind = classifyDocument(data.name, data.mimeType);
  const tags = data.tags ?? [];

  return (
    <AppShell
      title={data.name}
      description={`${documentLabel(data)} · ${data.kind === "folder" ? "—" : formatBytes(data.sizeBytes)}`}
      actions={
        <>
          <Button variant="outline" size="sm" asChild>
            <Link to="/explorer">
              <ArrowLeft className="size-4" />
              Explorer
            </Link>
          </Button>
          {data.kind === "file" ? (
            <Button size="sm" onClick={() => downloadMutation.mutate()}>
              <Download className="size-4" />
              Download
            </Button>
          ) : null}
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              if (!driveView) return;
              setShareTarget({
                driveId: driveView.drive.id,
                driveName: driveView.drive.name,
                resourceId: data.id,
                resourceName: data.name,
                resourceType: data.kind === "folder" ? "folder" : "file",
              });
            }}
          >
            Share
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => favoriteMutation.mutate(!data.favorite)}
          >
            <Star className={data.favorite ? "size-4 fill-warning text-warning" : "size-4"} />
            {data.favorite ? "Favorited" : "Favorite"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="text-destructive"
            onClick={() => trashMutation.mutate(!data.trashed)}
          >
            <Trash2 className="size-4" />
            {data.trashed ? "Restore" : "Trash"}
          </Button>
        </>
      }
    >
      <div className="grid gap-4 lg:grid-cols-[1fr_20rem]">
        <FilePreview file={data} />

        <div className="space-y-4">
          <section className="panel p-5">
            <h2 className="font-display text-sm font-semibold">Details</h2>
            <dl className="mt-4 space-y-3 text-sm">
              <Row label="Type" value={kind.label} />
              <Row
                label="Size"
                value={data.kind === "folder" ? "—" : formatBytes(data.sizeBytes)}
              />
              <Row label="Location" value={data.path} mono />
              <Row label="Modified" value={formatDateTime(data.modifiedAt)} />
              {data.createdAt ? (
                <Row label="Created" value={formatDateTime(data.createdAt)} />
              ) : null}
              {data.lastOpenedAt ? (
                <Row label="Last opened" value={formatDateTime(data.lastOpenedAt)} />
              ) : null}
              <div className="flex items-center justify-between gap-3">
                <dt className="text-muted-foreground">Drive</dt>
                <dd className="inline-flex items-center gap-2">
                  <ProviderIcon
                    icon={descriptor?.icon ?? "Cloud"}
                    accent={descriptor?.accent ?? "provider-r2"}
                    size="sm"
                    className="size-5 rounded"
                  />
                  {driveView?.drive.name ?? "unknown"}
                </dd>
              </div>
              <Row label="MIME type" value={data.mimeType || "unknown"} mono />
            </dl>
          </section>

          <section className="panel p-5">
            <h2 className="font-display text-sm font-semibold">Tags</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Tags live in ODrive only — they are never written back to the provider.
            </p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {tags.length === 0 ? (
                <span className="text-sm text-muted-foreground">No tags yet.</span>
              ) : (
                tags.map((tag) => (
                  <Badge key={tag} variant="secondary" className="gap-1">
                    #{tag}
                    <button
                      type="button"
                      aria-label={`Remove tag ${tag}`}
                      className="text-muted-foreground hover:text-foreground"
                      onClick={() => tagMutation.mutate(tags.filter((item) => item !== tag))}
                    >
                      ×
                    </button>
                  </Badge>
                ))
              )}
            </div>
            <form
              className="mt-3 flex gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                if (!tagDraft.trim()) return;
                tagMutation.mutate([...tags, tagDraft]);
              }}
            >
              <Input
                value={tagDraft}
                onChange={(event) => setTagDraft(event.target.value)}
                placeholder="Add a tag"
                aria-label="Add a tag"
                className="h-9"
              />
              <Button type="submit" size="sm" disabled={!tagDraft.trim()}>
                Add
              </Button>
            </form>
          </section>
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

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={mono ? "truncate font-mono text-xs" : "text-right"}>{value}</dd>
    </div>
  );
}

/** Inline preview for the safe kinds; everything else falls back to an icon. */
function FilePreview({
  file,
}: {
  file: {
    id: string;
    connectionId: string;
    kind: "folder" | "file";
    name: string;
    mimeType: string;
  };
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [text, setText] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const preview = file.kind === "folder" ? "none" : previewKind(file.name, file.mimeType);

  useEffect(() => {
    if (preview === "none") return;
    let objectUrl: string | null = null;
    let cancelled = false;
    setFailed(false);
    setText(null);
    setUrl(null);
    downloadBlob(file.connectionId, file.id)
      .then(async (blob) => {
        if (cancelled) return;
        if (preview === "text") {
          setText((await blob.text()).slice(0, 20000));
          return;
        }
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      })
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [file.id, file.connectionId, preview]);

  if (preview === "none" || failed) {
    return (
      <div className="panel flex min-h-72 flex-col items-center justify-center gap-3 p-8">
        <FileTypeIcon file={file} className="size-10" />
        <p className="text-sm text-muted-foreground">
          {failed ? "Preview unavailable for this file." : "No inline preview for this type."}
        </p>
      </div>
    );
  }

  return (
    <div className="panel min-h-72 overflow-hidden p-4">
      {preview === "image" ? (
        url ? (
          <img
            src={url}
            alt={file.name}
            className="mx-auto max-h-[32rem] w-auto rounded-lg object-contain"
          />
        ) : (
          <Skeleton className="h-72 w-full rounded-lg" />
        )
      ) : preview === "pdf" ? (
        url ? (
          <iframe src={url} title={file.name} className="h-[32rem] w-full rounded-lg" />
        ) : (
          <Skeleton className="h-72 w-full rounded-lg" />
        )
      ) : text !== null ? (
        <pre className="max-h-[32rem] overflow-auto rounded-lg bg-surface p-4 font-mono text-xs whitespace-pre-wrap">
          {text}
        </pre>
      ) : (
        <Skeleton className="h-72 w-full rounded-lg" />
      )}
    </div>
  );
}
