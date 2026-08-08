import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Plus } from "lucide-react";

import { DESCRIPTORS } from "@/adapters";
import { ProviderIcon } from "@/components/provider-icon";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createDrive } from "@/core/drives";
import type { ProviderDescriptor } from "@/core/types";

/**
 * Add Drive wizard: choose provider → authenticate with the provider's own
 * field schema → name the drive → pick a root. Any provider can be added as
 * many times as the user wants; each attempt creates its own connection.
 */
export function AddDriveDialog({ triggerLabel = "Add drive" }: { triggerLabel?: string }) {
  const [open, setOpen] = useState(false);
  const [provider, setProvider] = useState<ProviderDescriptor | null>(null);
  const [credentials, setCredentials] = useState<Record<string, string>>({});
  const [name, setName] = useState("");
  const [root, setRoot] = useState("");
  const queryClient = useQueryClient();

  const reset = () => {
    setProvider(null);
    setCredentials({});
    setName("");
    setRoot("");
  };

  const mutation = useMutation({
    mutationFn: () =>
      createDrive({
        providerId: provider!.id,
        credentials,
        name,
        ...(root ? { rootReference: root } : {}),
      }),
    onSuccess: (drive) => {
      queryClient.invalidateQueries();
      toast.success("Drive created", { description: drive.name });
      setOpen(false);
      reset();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Could not create drive"),
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button>
          <Plus className="size-4" />
          {triggerLabel}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{provider ? `New ${provider.name} drive` : "Choose a provider"}</DialogTitle>
          <DialogDescription>
            {provider
              ? `Credentials are sealed by the Secret Manager before storage (${provider.authKind}). Add this provider as often as you need — one drive per account.`
              : "A drive is one authenticated account. Providers support unlimited accounts."}
          </DialogDescription>
        </DialogHeader>

        {provider ? (
          <div className="space-y-4">
            {provider.fields.map((field) => (
              <div key={field.key} className="space-y-2">
                <Label htmlFor={field.key}>{field.label}</Label>
                <Input
                  id={field.key}
                  type={field.secret ? "password" : "text"}
                  placeholder={field.placeholder}
                  value={credentials[field.key] ?? ""}
                  onChange={(event) =>
                    setCredentials((prev) => ({ ...prev, [field.key]: event.target.value }))
                  }
                />
              </div>
            ))}
            <div className="space-y-2">
              <Label htmlFor="drive-name">Drive name</Label>
              <Input
                id="drive-name"
                placeholder="Company Assets"
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="drive-root">Root folder or bucket (optional)</Label>
              <Input
                id="drive-root"
                placeholder="/"
                value={root}
                onChange={(event) => setRoot(event.target.value)}
              />
            </div>
          </div>
        ) : (
          <div className="grid gap-2">
            {DESCRIPTORS.map((descriptor) => (
              <button
                key={descriptor.id}
                type="button"
                onClick={() => setProvider(descriptor)}
                className="flex items-center gap-3 rounded-lg border border-border p-3 text-left transition-colors hover:border-primary/40 hover:bg-accent"
              >
                <ProviderIcon icon={descriptor.icon} accent={descriptor.accent} />
                <span>
                  <span className="block text-sm font-medium">{descriptor.name}</span>
                  <span className="block text-xs text-muted-foreground">{descriptor.tagline}</span>
                </span>
              </button>
            ))}
          </div>
        )}

        {provider ? (
          <DialogFooter>
            <Button variant="ghost" onClick={reset}>
              Back
            </Button>
            <Button
              onClick={() => mutation.mutate()}
              disabled={mutation.isPending || !name.trim()}
            >
              {mutation.isPending ? "Validating…" : "Validate & create"}
            </Button>
          </DialogFooter>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
