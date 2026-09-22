import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { AdminNav } from "@/components/admin-nav";
import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  disableModule,
  enableModule,
  EXAMPLE_MODULE_PACKAGE,
  installExampleModule,
  installModulePackage,
  listModules,
  MODULE_REGISTRY_TABLES,
  runModuleAction,
  setModuleEntitlement,
  uninstallModule,
  validateModulePackage,
  type InstalledModule,
  type ModuleManifest,
  type ModulePackageInput,
} from "@/core/modules";
import { modulesQuery } from "@/lib/queries";

export const Route = createFileRoute("/_authenticated/admin/modules")({
  head: () => ({
    meta: [
      { title: "Modules — ODrive admin" },
      { name: "description", content: "Install, validate and manage ODrive modules without granting direct infrastructure access." },
      { property: "og:title", content: "Modules — ODrive admin" },
      { property: "og:description", content: "Secure module lifecycle, entitlements and runtime permissions." },
    ],
  }),
  component: AdminModules,
});

const badgeClass: Record<string, string> = {
  enabled: "border-success/30 bg-success/10 text-success",
  installed: "border-primary/30 bg-primary/10 text-primary",
  disabled: "border-border bg-muted text-muted-foreground",
  blocked: "border-destructive/30 bg-destructive/10 text-destructive",
  free: "border-success/30 bg-success/10 text-success",
  pro: "border-warning/30 bg-warning/15 text-warning-foreground",
  enterprise: "border-primary/30 bg-primary/10 text-primary",
  private: "border-border bg-muted text-muted-foreground",
};

const seedUpload = JSON.stringify(EXAMPLE_MODULE_PACKAGE, null, 2);

function AdminModules() {
  const queryClient = useQueryClient();
  const modules = useQuery(modulesQuery);
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["modules"] });

  const installExample = useMutation({
    mutationFn: installExampleModule,
    onSuccess: () => {
      invalidate();
      toast.success("Example module installed");
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const toggle = useMutation({
    mutationFn: ({ moduleId, operation }: { moduleId: string; operation: "enable" | "disable" }) =>
      operation === "enable" ? enableModule(moduleId) : disableModule(moduleId),
    onSuccess: (_, input) => {
      invalidate();
      toast.success(`Module ${input.operation}d`);
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const entitlement = useMutation({
    mutationFn: ({ moduleId, entitled }: { moduleId: string; entitled: boolean }) =>
      setModuleEntitlement(moduleId, entitled),
    onSuccess: () => {
      invalidate();
      toast.success("Entitlement updated");
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const uninstall = useMutation({
    mutationFn: ({ moduleId, deleteData }: { moduleId: string; deleteData: boolean }) =>
      uninstallModule(moduleId, deleteData),
    onSuccess: () => {
      invalidate();
      toast.success("Module uninstalled");
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const testAction = useMutation({
    mutationFn: (moduleId: string) =>
      runModuleAction(moduleId, "transfer.create", {
        connectionId: "demo",
        fileName: "module-runtime-check.txt",
        direction: "upload",
        sizeBytes: 128,
      }),
    onSuccess: (result) => {
      if (result.success) toast.success("Module action reached ActionService");
      else toast.error(result.error?.message ?? "Module action failed");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const snapshot = modules.data ?? listModules();

  return (
    <AppShell
      title="Modules"
      description="Secure extension lifecycle, runtime permissions and entitlements."
      actions={
        <Button size="sm" onClick={() => installExample.mutate()} disabled={installExample.isPending}>
          Install example module
        </Button>
      }
    >
      <AdminNav />

      <div className="grid gap-3 md:grid-cols-4">
        <Metric label="Installed" value={String(snapshot.installed.length)} />
        <Metric label="Enabled" value={String(snapshot.installed.filter((module) => module.status === "enabled").length)} />
        <Metric label="Runtime" value={snapshot.runtime.healthy ? "Healthy" : "Blocked"} />
        <Metric label="Registry tables" value={String(MODULE_REGISTRY_TABLES.length)} />
      </div>

      <Tabs defaultValue="installed" className="mt-4">
        <TabsList>
          <TabsTrigger value="installed">Installed</TabsTrigger>
          <TabsTrigger value="available">Available</TabsTrigger>
          <TabsTrigger value="upload">Upload Module</TabsTrigger>
        </TabsList>

        <TabsContent value="installed" className="space-y-3">
          {snapshot.installed.length ? snapshot.installed.map((module) => (
            <InstalledModuleCard
              key={module.manifest.id}
              module={module}
              onEnable={() => toggle.mutate({ moduleId: module.manifest.id, operation: "enable" })}
              onDisable={() => toggle.mutate({ moduleId: module.manifest.id, operation: "disable" })}
              onGrant={() => entitlement.mutate({ moduleId: module.manifest.id, entitled: true })}
              onRevoke={() => entitlement.mutate({ moduleId: module.manifest.id, entitled: false })}
              onTest={() => testAction.mutate(module.manifest.id)}
              onUninstall={(deleteData) => uninstall.mutate({ moduleId: module.manifest.id, deleteData })}
            />
          )) : (
            <section className="panel p-5 text-sm text-muted-foreground">
              No modules installed yet. Install the example module to verify install to uninstall lifecycle.
            </section>
          )}
        </TabsContent>

        <TabsContent value="available" className="grid gap-3 lg:grid-cols-2">
          {snapshot.available.map((manifest) => (
            <AvailableModuleCard key={manifest.id} manifest={manifest} installed={snapshot.installed.some((module) => module.manifest.id === manifest.id)} />
          ))}
        </TabsContent>

        <TabsContent value="upload">
          <UploadModule invalidate={invalidate} />
        </TabsContent>
      </Tabs>

      <section className="panel mt-4 p-5">
        <h2 className="font-display text-sm font-semibold">Runtime boundary</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Modules cannot access database adapters, provider credentials, environment secrets or Worker bindings. Enabled modules can only request declared actions through the Universal Action Layer.
        </p>
        <div className="mt-3 grid gap-2 md:grid-cols-2">
          <Info label="Allowed actions" value={snapshot.runtime.allowedActions.length ? snapshot.runtime.allowedActions.join(", ") : "none"} />
          <Info label="Extension points" value={snapshot.runtime.extensionPoints.length ? snapshot.runtime.extensionPoints.map((item) => `${item.point}: ${item.label}`).join(", ") : "none"} />
        </div>
      </section>
    </AppShell>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="panel p-4">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 font-display text-2xl font-semibold">{value}</p>
    </div>
  );
}

function Pill({ value }: { value: string }) {
  return <Badge variant="outline" className={badgeClass[value] ?? ""}>{value}</Badge>;
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border p-3">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm">{value}</p>
    </div>
  );
}

function InstalledModuleCard({
  module,
  onEnable,
  onDisable,
  onGrant,
  onRevoke,
  onTest,
  onUninstall,
}: {
  module: InstalledModule;
  onEnable: () => void;
  onDisable: () => void;
  onGrant: () => void;
  onRevoke: () => void;
  onTest: () => void;
  onUninstall: (deleteData: boolean) => void;
}) {
  return (
    <section className="panel p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-display text-base font-semibold">{module.manifest.name}</h2>
            <Pill value={module.status} />
            <Pill value={module.manifest.edition} />
            <Badge variant="outline">{module.manifest.kind}</Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{module.manifest.description}</p>
          <p className="mt-2 font-mono text-xs text-muted-foreground">
            {module.manifest.id} · v{module.manifest.version} · {module.packageChecksum}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {module.status === "enabled" ? (
            <Button size="sm" variant="secondary" onClick={onDisable}>Disable</Button>
          ) : (
            <Button size="sm" onClick={onEnable}>Enable</Button>
          )}
          <Button size="sm" variant="secondary" onClick={module.entitlement.entitled ? onRevoke : onGrant}>
            {module.entitlement.entitled ? "Revoke entitlement" : "Grant entitlement"}
          </Button>
          <Button size="sm" variant="secondary" onClick={onTest} disabled={module.status !== "enabled"}>Test ActionService</Button>
          <Button size="sm" variant="destructive" onClick={() => onUninstall(false)}>Uninstall</Button>
        </div>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <Info label="Permissions" value={module.permissions.map((permission) => permission.label).join(", ")} />
        <Info label="Entitlement" value={`${module.entitlement.entitled ? "Entitled" : "Not entitled"} · ${module.entitlement.reason}`} />
        <Info label="Migrations" value={module.migrationState} />
      </div>
      <div className="mt-3">
        <Button size="sm" variant="outline" onClick={() => onUninstall(true)}>
          Uninstall + delete module data
        </Button>
      </div>
    </section>
  );
}

function AvailableModuleCard({ manifest, installed }: { manifest: ModuleManifest; installed: boolean }) {
  return (
    <section className="panel p-5">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="font-display text-base font-semibold">{manifest.name}</h2>
        <Pill value={manifest.edition} />
        <Badge variant="outline">{manifest.kind}</Badge>
        {installed ? <Badge variant="outline">installed</Badge> : null}
      </div>
      <p className="mt-1 text-sm text-muted-foreground">{manifest.description}</p>
      <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
        <Info label="Author" value={manifest.author} />
        <Info label="Compatibility" value={manifest.odriveVersion} />
      </div>
    </section>
  );
}

function UploadModule({ invalidate }: { invalidate: () => void }) {
  const [raw, setRaw] = useState(seedUpload);
  const install = useMutation({
    mutationFn: (pkg: ModulePackageInput) => installModulePackage(pkg),
    onSuccess: () => {
      invalidate();
      toast.success("Module package installed");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  let parsed: ModulePackageInput | null = null;
  let parseError = "";
  try {
    parsed = JSON.parse(raw) as ModulePackageInput;
  } catch (error) {
    parseError = error instanceof Error ? error.message : "Invalid JSON";
  }
  const validation = parsed ? validateModulePackage(parsed) : { valid: false, errors: [parseError], warnings: [] };

  return (
    <section className="panel p-5">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div>
          <Label htmlFor="module-package">Module package descriptor</Label>
          <Textarea
            id="module-package"
            className="mt-2 min-h-96 font-mono text-xs"
            value={raw}
            onChange={(event) => setRaw(event.target.value)}
          />
          <div className="mt-3 flex flex-wrap gap-2">
            <Button size="sm" onClick={() => parsed && install.mutate(parsed)} disabled={!validation.valid || install.isPending}>
              Validate and install
            </Button>
            <Button size="sm" variant="secondary" onClick={() => setRaw(seedUpload)}>
              Load example package
            </Button>
          </div>
        </div>
        <div className="space-y-3">
          <Info label="ZIP installer policy" value="Validate metadata, manifest, file count, checksum, paths and declarative migrations before storage." />
          <Input value={parsed?.fileName ?? "module.zip"} readOnly aria-label="Package filename preview" />
          <ValidationList title="Errors" items={validation.errors} tone="destructive" empty="No blocking errors." />
          <ValidationList title="Warnings" items={validation.warnings} tone="warning" empty="No warnings." />
        </div>
      </div>
    </section>
  );
}

function ValidationList({ title, items, tone, empty }: { title: string; items: string[]; tone: "destructive" | "warning"; empty: string }) {
  return (
    <div className="rounded-md border border-border p-3">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{title}</p>
      <div className="mt-2 space-y-1 text-sm">
        {items.length ? items.map((item) => (
          <p key={item} className={tone === "destructive" ? "text-destructive" : "text-warning-foreground"}>{item}</p>
        )) : <p className="text-muted-foreground">{empty}</p>}
      </div>
    </div>
  );
}
