import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { AdminNav } from "@/components/admin-nav";
import { AppShell } from "@/components/app-shell";
import { ProviderIcon } from "@/components/provider-icon";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DESCRIPTORS } from "@/adapters";
import {
  credentialSlots,
  deleteCredential,
  revealCredential,
  rotationDueInDays,
  saveCredential,
  setCredentialStatus,
} from "@/core/credentials";
import type { CredentialRecord } from "@/core/types";
import { formatDateTime } from "@/lib/format";
import { credentialsQuery } from "@/lib/queries";

export const Route = createFileRoute("/_authenticated/admin/credentials")({
  head: () => ({
    meta: [
      { title: "Credentials — ODrive admin" },
      {
        name: "description",
        content:
          "Per-provider OAuth clients, API keys and system secrets — encrypted at rest with rotation tracking.",
      },
      { property: "og:title", content: "Credentials — ODrive admin" },
      {
        property: "og:description",
        content: "Encrypted credential vault with rotation SLAs and audit trail.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdminCredentials,
});

const SYSTEM_SLOTS = [
  { key: "ODRIVE_ENCRYPTION_KEY", label: "Credential encryption key" },
  { key: "ODRIVE_WEBHOOK_SECRET", label: "Webhook signing secret" },
];

function AdminCredentials() {
  const credentials = useQuery(credentialsQuery);
  const queryClient = useQueryClient();
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [revealed, setRevealed] = useState<Record<string, string>>({});

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["credentials"] });

  const save = useMutation({
    mutationFn: (input: Parameters<typeof saveCredential>[0]) => saveCredential(input),
    onSuccess: (record) => {
      setDrafts((previous) => ({ ...previous, [record.key]: "" }));
      invalidate();
      toast.success(`${record.key} stored (encrypted)`);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const reveal = useMutation({
    mutationFn: (id: string) => revealCredential(id),
    onSuccess: (value, id) => {
      setRevealed((previous) => ({ ...previous, [id]: value ?? "not stored in this environment" }));
      toast.info("Reveal recorded in the security log");
    },
  });

  const status = useMutation({
    mutationFn: ({ id, next }: { id: string; next: CredentialRecord["status"] }) =>
      setCredentialStatus(id, next),
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteCredential(id),
    onSuccess: () => {
      invalidate();
      toast.success("Credential deleted");
    },
  });

  const recordFor = (providerId: string | null, key: string) =>
    credentials.data?.find(
      (record) => record.providerId === providerId && record.key === key,
    );

  const slotRow = (
    providerId: string | null,
    slot: { key: string; label: string; type?: CredentialRecord["type"] },
  ) => {
    const record = recordFor(providerId, slot.key);
    const draft = drafts[slot.key] ?? "";
    return (
      <div key={slot.key} className="grid gap-2 border-t border-border py-3 md:grid-cols-[1fr_auto]">
        <div>
          <Label htmlFor={slot.key} className="text-xs">
            {slot.label}
          </Label>
          <p className="font-mono text-[11px] text-muted-foreground">{slot.key}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Input
              id={slot.key}
              type="password"
              autoComplete="off"
              placeholder={record ? record.maskedValue : "not configured"}
              value={draft}
              onChange={(event) =>
                setDrafts((previous) => ({ ...previous, [slot.key]: event.target.value }))
              }
              className="h-8 max-w-xs"
            />
            <Button
              size="sm"
              variant="secondary"
              disabled={!draft.trim() || save.isPending}
              onClick={() =>
                save.mutate({
                  ...(record ? { id: record.id } : {}),
                  providerId,
                  type: slot.type ?? (providerId ? "api-key" : "secret"),
                  label: slot.label,
                  key: slot.key,
                  plaintext: draft,
                })
              }
            >
              {record ? "Rotate" : "Save"}
            </Button>
            {record ? (
              <>
                <Button size="sm" variant="ghost" onClick={() => reveal.mutate(record.id)}>
                  Reveal
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() =>
                    status.mutate({
                      id: record.id,
                      next: record.status === "active" ? "disabled" : "active",
                    })
                  }
                >
                  {record.status === "active" ? "Disable" : "Enable"}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-destructive"
                  onClick={() => remove.mutate(record.id)}
                >
                  Delete
                </Button>
              </>
            ) : null}
          </div>
          {revealed[record?.id ?? ""] ? (
            <p className="mt-2 font-mono text-xs break-all text-warning-foreground">
              {revealed[record?.id ?? ""]}
            </p>
          ) : null}
        </div>
        <div className="text-right text-xs text-muted-foreground">
          {record ? (
            <>
              <Badge variant="outline" className="capitalize">
                {record.status}
              </Badge>
              <p className="mt-1">
                rotated {record.lastRotatedAt ? formatDateTime(record.lastRotatedAt) : "never"}
              </p>
              <p className={rotationDueInDays(record) < 0 ? "text-destructive" : ""}>
                rotation {rotationDueInDays(record) < 0 ? "overdue" : "due"} in{" "}
                {Math.abs(rotationDueInDays(record))}d
              </p>
            </>
          ) : (
            <Badge variant="outline">missing</Badge>
          )}
        </div>
      </div>
    );
  };

  return (
    <AppShell
      title="Credentials"
      description="AES-256-GCM at rest, masked by default, every change audited."
    >
      <AdminNav />

      <div className="space-y-4">
        {DESCRIPTORS.map((descriptor) => (
          <section key={descriptor.id} className="panel p-5">
            <div className="flex items-center gap-3">
              <ProviderIcon icon={descriptor.icon} accent={descriptor.accent} size="sm" />
              <div>
                <h2 className="font-display text-sm font-semibold">{descriptor.name}</h2>
                <p className="font-mono text-[11px] text-muted-foreground">
                  {descriptor.authKind} credentials
                </p>
              </div>
            </div>
            <div className="mt-2">
              {credentialSlots(descriptor.id).map((slot) =>
                slotRow(descriptor.id, { key: slot.key, label: slot.label, type: slot.type }),
              )}
            </div>
          </section>
        ))}

        <section className="panel p-5">
          <h2 className="font-display text-sm font-semibold">System secrets</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Not tied to a provider. Stored separately from configuration values.
          </p>
          <div className="mt-2">
            {SYSTEM_SLOTS.map((slot) => slotRow(null, { ...slot, type: "secret" }))}
          </div>
        </section>

        <section className="panel p-5">
          <h2 className="font-display text-sm font-semibold">Vault inventory</h2>
          <Table className="mt-3">
            <TableHeader>
              <TableRow>
                <TableHead>Key</TableHead>
                <TableHead>Provider</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Value</TableHead>
                <TableHead>Rotation</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(credentials.data ?? []).map((record) => (
                <TableRow key={record.id}>
                  <TableCell className="font-mono text-xs">{record.key}</TableCell>
                  <TableCell className="text-xs">{record.providerId ?? "system"}</TableCell>
                  <TableCell className="text-xs capitalize">{record.type}</TableCell>
                  <TableCell className="font-mono text-xs">{record.maskedValue}</TableCell>
                  <TableCell className="text-xs">{record.rotationDays}d</TableCell>
                  <TableCell className="text-xs capitalize">{record.status}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </section>
      </div>
    </AppShell>
  );
}
