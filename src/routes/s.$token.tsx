import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Download, File as FileIcon, Folder, Lock, ShieldAlert } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { OdriveLogo } from "@/components/odrive-logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  downloadShare,
  getShareResource,
  ShareError,
  SHARE_ERROR_MESSAGES,
} from "@/core/shares";
import type { PublicShareResource } from "@/core/types";
import { formatBytes, formatDateTime } from "@/lib/format";

export const Route = createFileRoute("/s/$token")({
  head: () => ({
    meta: [
      { title: "Shared with you — ODrive" },
      {
        name: "description",
        content: "A file or folder shared securely through ODrive. Preview or download it here.",
      },
      { property: "og:title", content: "Shared with you — ODrive" },
      {
        property: "og:description",
        content: "A secure, time-bound ODrive share link.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: PublicSharePage,
});

function message(error: unknown): string {
  if (error instanceof ShareError) return SHARE_ERROR_MESSAGES[error.code];
  return error instanceof Error ? error.message : "Something went wrong.";
}

function PublicSharePage() {
  const { token } = Route.useParams();
  const [password, setPassword] = useState("");
  const [submitted, setSubmitted] = useState<string | undefined>(undefined);

  const resource = useQuery<PublicShareResource>({
    queryKey: ["public-share", token, submitted ?? ""],
    queryFn: () => getShareResource(token, submitted),
    retry: false,
  });

  const download = useMutation({
    mutationFn: (fileId?: string) => downloadShare(token, fileId, submitted),
    onSuccess: (result) => {
      toast.success(`Download ready — ${result.name}`, {
        description:
          result.strategy === "temporary-url"
            ? "Served via a short-lived temporary URL."
            : result.strategy === "stream"
              ? "Streaming directly from storage."
              : "Prepared for download.",
      });
      void resource.refetch();
    },
    onError: (error) => toast.error(message(error)),
  });

  const passwordRequired =
    resource.error instanceof ShareError &&
    (resource.error.code === "PASSWORD_REQUIRED" || resource.error.code === "INVALID_PASSWORD");

  return (
    <main className="flex min-h-screen flex-col items-center bg-background px-4 py-12">
      <OdriveLogo />

      <div className="panel mt-8 w-full max-w-xl p-6">
        {resource.isLoading ? (
          <p className="text-sm text-muted-foreground">Checking link…</p>
        ) : passwordRequired ? (
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              setSubmitted(password);
            }}
          >
            <div className="flex items-center gap-2">
              <Lock className="size-5 text-primary" />
              <h1 className="text-lg font-semibold">This link is password protected</h1>
            </div>
            <p className="text-sm text-muted-foreground">
              Ask the person who shared it for the password. Attempts are rate limited.
            </p>
            <div className="space-y-2">
              <Label htmlFor="share-password">Password</Label>
              <Input
                id="share-password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoFocus
              />
            </div>
            {resource.error instanceof ShareError &&
            resource.error.code === "INVALID_PASSWORD" ? (
              <p className="text-sm text-destructive">{SHARE_ERROR_MESSAGES.INVALID_PASSWORD}</p>
            ) : null}
            <Button type="submit" className="w-full">
              Unlock
            </Button>
          </form>
        ) : resource.error ? (
          <div className="space-y-2 text-center">
            <ShieldAlert className="mx-auto size-6 text-destructive" />
            <h1 className="text-lg font-semibold">Link unavailable</h1>
            <p className="text-sm text-muted-foreground">{message(resource.error)}</p>
          </div>
        ) : resource.data ? (
          <div className="space-y-5">
            <header className="flex items-start gap-3">
              {resource.data.resourceType === "folder" ? (
                <Folder className="mt-0.5 size-6 text-primary" strokeWidth={1.8} />
              ) : (
                <FileIcon className="mt-0.5 size-6 text-muted-foreground" strokeWidth={1.8} />
              )}
              <div className="min-w-0">
                <h1 className="truncate text-lg font-semibold">{resource.data.name}</h1>
                <p className="mt-1 font-mono text-xs text-muted-foreground">
                  {resource.data.resourceType === "folder"
                    ? `${resource.data.children?.length ?? 0} items`
                    : formatBytes(resource.data.sizeBytes)}
                  {resource.data.expiresAt
                    ? ` · expires ${formatDateTime(resource.data.expiresAt)}`
                    : " · no expiry"}
                  {resource.data.downloadsRemaining !== null
                    ? ` · ${resource.data.downloadsRemaining} downloads left`
                    : ""}
                </p>
              </div>
            </header>

            {resource.data.resourceType === "folder" ? (
              <div className="divide-y divide-border rounded-lg border border-border">
                {(resource.data.children ?? []).length === 0 ? (
                  <p className="p-4 text-sm text-muted-foreground">This folder is empty.</p>
                ) : (
                  (resource.data.children ?? []).map((child) => (
                    <div key={child.id} className="flex items-center gap-3 px-4 py-2.5">
                      {child.kind === "folder" ? (
                        <Folder className="size-4 text-primary" strokeWidth={1.8} />
                      ) : (
                        <FileIcon className="size-4 text-muted-foreground" strokeWidth={1.8} />
                      )}
                      <span className="min-w-0 flex-1 truncate text-sm">{child.name}</span>
                      <span className="font-mono text-xs text-muted-foreground">
                        {child.kind === "folder" ? "—" : formatBytes(child.sizeBytes)}
                      </span>
                      {resource.data.allowDownload && child.kind === "file" ? (
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`Download ${child.name}`}
                          onClick={() => download.mutate(child.id)}
                        >
                          <Download className="size-4" />
                        </Button>
                      ) : null}
                    </div>
                  ))
                )}
              </div>
            ) : resource.data.allowPreview ? (
              <div className="rounded-lg border border-border bg-surface p-6 text-center text-sm text-muted-foreground">
                Preview available for this {resource.data.mimeType.split("/")[0]} item.
              </div>
            ) : null}

            {resource.data.allowDownload ? (
              <Button
                className="w-full"
                onClick={() => download.mutate(undefined)}
                disabled={download.isPending}
              >
                <Download className="size-4" />
                {download.isPending ? "Preparing…" : "Download"}
              </Button>
            ) : (
              <p className="text-center text-sm text-muted-foreground">
                Downloads are disabled for this link.
              </p>
            )}
          </div>
        ) : null}
      </div>

      <p className="mt-6 text-xs text-muted-foreground">Shared securely with ODrive</p>
    </main>
  );
}
