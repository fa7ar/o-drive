import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { listProviders } from "@/core/registry";
import { saveSettings } from "@/core/services";
import { useAuth } from "@/hooks/useAuth";
import { settingsQuery } from "@/lib/queries";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [
      { title: "Settings — ODrive" },
      {
        name: "description",
        content: "Workspace name, default connection behaviour and the registered provider adapters.",
      },
      { property: "og:title", content: "Settings — ODrive" },
      {
        property: "og:description",
        content: "Workspace preferences and the registered storage adapters.",
      },
    ],
  }),
  component: SettingsPage;
});

function SettingsPage() {
  return null;
}
