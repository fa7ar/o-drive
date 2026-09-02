import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowRight, Check, HardDrive, Sparkles } from "lucide-react";

import { AddDriveDialog } from "@/components/add-drive-dialog";
import { OdriveLogo } from "@/components/odrive-logo";
import { ProviderIcon } from "@/components/provider-icon";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateSettings } from "@/core/services";
import { drivesQuery, settingsQuery } from "@/lib/queries";

const STEPS = ["Welcome", "Workspace", "Add drive"] as const;

export const Route = createFileRoute("/_authenticated/onboarding")({
  head: () => ({
    meta: [
      { title: "Get started — ODrive onboarding" },
      {
        name: "description",
        content: "Three steps to a working ODrive workspace: welcome, name your workspace, add your first drive.",
      },
      { property: "og:title", content: "Get started — ODrive onboarding" },
      {
        property: "og:description",
        content: "Name your workspace and connect your first storage account in three steps.",
      },
    ],
  }),
  component: Onboarding,
});

function Onboarding() {
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const settings = useQuery(settingsQuery);
  const drives = useQuery(drivesQuery);
  const driveCount = drives.data?.length ?? 0;

  const save = useMutation({
    mutationFn: (workspaceName: string) => updateSettings({ workspaceName }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: settingsQuery.queryKey });
      setStep(2);
    },
    onError: () => toast.error("Could not save the workspace name"),
  });

  const current = settings.data?.workspaceName ?? "";

  return (
    <div className="mx-auto flex min-h-screen max-w-2xl flex-col px-6 py-12">
      <OdriveLogo />

      <ol className="mt-10 flex items-center gap-3 text-xs font-medium">
        {STEPS.map((label, index) => (
          <li key={label} className="flex flex-1 items-center gap-2">
            <span
              className={`inline-flex size-6 items-center justify-center rounded-full border text-[11px] ${
                index <= step
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border text-muted-foreground"
              }`}
            >
              {index < step ? <Check className="size-3.5" /> : index + 1}
            </span>
            <span className={index <= step ? "" : "text-muted-foreground"}>{label}</span>
            {index < STEPS.length - 1 ? <span className="h-px flex-1 bg-border" /> : null}
          </li>
        ))}
      </ol>

      <div className="panel mt-8 p-8">
        {step === 0 ? (
          <div>
            <Sparkles className="size-5 text-primary" strokeWidth={1.8} />
            <h1 className="mt-4 text-2xl font-semibold">Welcome to ODrive</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              ODrive turns unlimited storage accounts into one workspace. Connect drives, browse
              every file in a single explorer, move data between providers and automate the boring
              parts — without vendor lock-in.
            </p>
            <Button className="mt-6" onClick={() => setStep(1)}>
              Get started
              <ArrowRight className="size-4" />
            </Button>
          </div>
        ) : null}

        {step === 1 ? (
          <div>
            <h1 className="text-2xl font-semibold">Name your workspace</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Everything — drives, transfers, shares and automations — is scoped to this workspace.
            </p>
            <div className="mt-6 space-y-2">
              <Label htmlFor="workspace">Workspace name</Label>
              <Input
                id="workspace"
                value={name || current}
                onChange={(event) => setName(event.target.value)}
                placeholder="Acme Storage"
                maxLength={60}
              />
            </div>
            <div className="mt-6 flex gap-2">
              <Button
                disabled={!(name || current).trim() || save.isPending}
                onClick={() => save.mutate((name || current).trim())}
              >
                Continue
                <ArrowRight className="size-4" />
              </Button>
              <Button variant="ghost" onClick={() => setStep(2)}>
                Skip
              </Button>
            </div>
          </div>
        ) : null}

        {step === 2 ? (
          <div>
            <HardDrive className="size-5 text-primary" strokeWidth={1.8} />
            <h1 className="mt-4 text-2xl font-semibold">Add your first drive</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Pick a provider and authenticate. Production-ready providers are marked; beta and
              coming-soon providers are labelled so you always know what you are relying on.
            </p>

            {driveCount > 0 ? (
              <div className="mt-6 space-y-2">
                {drives.data?.slice(0, 4).map((view) => (
                  <div
                    key={view.drive.id}
                    className="flex items-center gap-3 rounded-lg border border-border px-3 py-2"
                  >
                    {view.descriptor ? (
                      <ProviderIcon icon={view.descriptor.icon} accent={view.descriptor.accent} />
                    ) : null}
                    <span className="text-sm font-medium">{view.drive.name}</span>
                  </div>
                ))}
              </div>
            ) : null}

            <div className="mt-6 flex flex-wrap gap-2">
              <AddDriveDialog triggerLabel={driveCount > 0 ? "Add another drive" : "Add drive"} />
              <Button
                variant={driveCount > 0 ? "default" : "outline"}
                onClick={() => navigate({ to: "/dashboard" })}
              >
                {driveCount > 0 ? "Go to dashboard" : "Do this later"}
                <ArrowRight className="size-4" />
              </Button>
            </div>
          </div>
        ) : null}
      </div>

      <p className="mt-6 text-center text-xs text-muted-foreground">
        Need the full picture?{" "}
        <Link to="/dashboard" className="text-primary hover:underline">
          Skip onboarding
        </Link>
      </p>
    </div>
  );
}
