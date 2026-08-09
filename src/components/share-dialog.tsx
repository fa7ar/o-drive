import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Copy, Link2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { createShare, shareUrl } from "@/core/shares";
import type { Share, ShareType } from "@/core/types";

export interface ShareTarget {
  driveId: string;
  driveName: string;
  resourceId: string;
  resourceName: string;
  resourceType: Share["resourceType"];
}

const EXPIRY = [
  { value: "1", label: "1 hour" },
  { value: "24", label: "1 day" },
  { value: "168", label: "7 days" },
  { value: "720", label: "30 days" },
  { value: "never", label: "Never" },
] as const;

/** Provider-agnostic share dialog. It never references a storage vendor. */
export function ShareDialog({
  target,
  open,
  onOpenChange,
}: {
  target: ShareTarget | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const [shareType, setShareType] = useState<ShareType>("public");
  const [password, setPassword] = useState("");
  const [expiry, setExpiry] = useState<string>("168");
  const [allowDownload, setAllowDownload] = useState(true);
  const [allowPreview, setAllowPreview] = useState(true);
  const [maxDownloads, setMaxDownloads] = useState("");
  const [link, setLink] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!target) throw new Error("Nothing selected");
      const created = await createShare({
        driveId: target.driveId,
        resourceId: target.resourceId,
        resourceType: target.resourceType,
        resourceName: target.resourceName,
        shareType,
        ...(shareType === "password_protected" ? { password } : {}),
        expiresInHours: expiry === "never" ? null : Number(expiry),
        allowDownload,
        allowPreview,
        maxDownloads: maxDownloads ? Number(maxDownloads) : null,
      });
      return created;
    },
    onSuccess: async (created) => {
      setLink(shareUrl(created.token));
      await queryClient.invalidateQueries({ queryKey: ["shares"] });
      toast.success("Share link created");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  async function copy(value: string) {
    await navigator.clipboard.writeText(value);
    toast.success("Link copied");
  }

  function close(next: boolean) {
    if (!next) {
      setLink(null);
      setPassword("");
    }
    onOpenChange(next);
  }

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Share “{target?.resourceName ?? ""}”</DialogTitle>
          <DialogDescription>
            {target?.resourceType === "folder" ? "Folder" : "File"} in {target?.driveName ?? "drive"} —
            the public link never exposes the underlying storage account.
          </DialogDescription>
        </DialogHeader>

        {link ? (
          <div className="space-y-3">
            <Label htmlFor="share-link">Public link</Label>
            <div className="flex gap-2">
              <Input id="share-link" readOnly value={link} className="font-mono text-xs" />
              <Button variant="secondary" onClick={() => copy(link)} aria-label="Copy link">
                <Copy className="size-4" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Manage, revoke or rotate this link any time from the Shares page.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Access</Label>
              <Select value={shareType} onValueChange={(value) => setShareType(value as ShareType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="public">Public — anyone with the link</SelectItem>
                  <SelectItem value="password_protected">Password protected</SelectItem>
                  <SelectItem value="private">Private — signed-in users</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {shareType === "password_protected" ? (
              <div className="space-y-2">
                <Label htmlFor="share-password">Password</Label>
                <Input
                  id="share-password"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="At least 8 characters"
                />
              </div>
            ) : null}

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Expires</Label>
                <Select value={expiry} onValueChange={setExpiry}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {EXPIRY.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="share-limit">Download limit</Label>
                <Input
                  id="share-limit"
                  inputMode="numeric"
                  value={maxDownloads}
                  onChange={(event) => setMaxDownloads(event.target.value.replace(/\D/g, ""))}
                  placeholder="Unlimited"
                />
              </div>
            </div>

            <div className="space-y-3 rounded-lg border border-border p-3">
              <div className="flex items-center justify-between">
                <Label htmlFor="allow-preview">Allow preview</Label>
                <Switch id="allow-preview" checked={allowPreview} onCheckedChange={setAllowPreview} />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="allow-download">Allow download</Label>
                <Switch
                  id="allow-download"
                  checked={allowDownload}
                  onCheckedChange={setAllowDownload}
                />
              </div>
            </div>
          </div>
        )}

        <DialogFooter>
          {link ? (
            <Button variant="secondary" onClick={() => close(false)}>
              Done
            </Button>
          ) : (
            <Button onClick={() => mutation.mutate()} disabled={mutation.isPending || !target}>
              <Link2 className="size-4" />
              {mutation.isPending ? "Creating…" : "Create link"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
