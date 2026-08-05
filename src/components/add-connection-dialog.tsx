import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
import { createConnection } from "@/core/services";
import type { ProviderDescriptor } from "@/core/types";

export function AddConnectionDialog({ triggerLabel = "Add connection" }: { triggerLabel?: string }) {
  const [open, setOpen] = useState(false);
  const [provider, setProvider] = useState<ProviderDescriptor | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: () => createConnection(provider!.id, values),
    onSuccess: (connection) => {
      queryClient.invalidateQueries();
      toast.success("Connection added", { description: connection.name });
      setOpen(false);
      setProvider(null);
      setValues({});
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Could not connect"),
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          setProvider(null);
          setValues({});
        }
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
          <DialogTitle>{provider ? `Connect ${provider.name}` : "Choose a provider"}</DialogTitle>
          <DialogDescription>
            {provider
              ? `Credentials are sealed by the Secret Manager before storage (${provider.authKind}).`
              : "Every provider goes through the same adapter interface — add as many accounts as you like."}
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
                  value={values[field.key] ?? ""}
                  onChange={(event) =>
                    setValues((prev) => ({ ...prev, [field.key]: event.target.value }))
                  }
                />
              </div>
            ))}
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
            <Button variant="ghost" onClick={() => setProvider(null)}>
              Back
            </Button>
            <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>
              {mutation.isPending ? "Connecting…" : "Connect"}
            </Button>
          </DialogFooter>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

export function useConnectionsQuery() {
  return useQuery({
    queryKey: ["connections"],
    queryFn: () => import("@/core/services").then((m) => m.listConnections()),
  });
}
