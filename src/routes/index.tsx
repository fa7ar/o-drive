import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Check } from "lucide-react";

import { DESCRIPTORS } from "@/adapters";
import { OdriveLogo } from "@/components/odrive-logo";
import { ProviderIcon } from "@/components/provider-icon";
import { PublicFooter } from "@/components/public-footer";
import { ReadinessBadge } from "@/components/readiness-badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { footerContentQuery, readinessQuery } from "@/lib/queries";

const TITLE = "ODrive — one workspace for every storage account";
const DESCRIPTION =
  "Connect unlimited storage accounts across providers and manage every file from a single, calm workspace. Google Drive, Cloudflare R2 and Amazon S3 are production ready today, with OneDrive and Telegram available as beta live adapters.";

const POINTS = [
  "Connect as many accounts as you like, across providers",
  "Browse, move and share files without switching tabs",
  "Automations, transfers and audit trails on every account",
];

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Home,
});

function Home() {
  const { user } = useAuth();
  const footerContent = useQuery(footerContentQuery);
  const readiness = useQuery(readinessQuery);
  const providerReadiness = new Map(
    (readiness.data?.groups.providers ?? []).map((item) => [item.id, item.publicStatus ?? "coming-soon"]),
  );

  return (
    <div className="min-h-screen bg-background">
      <header className="mx-auto flex h-16 max-w-3xl items-center justify-between px-6">
        <OdriveLogo />
        <div className="flex items-center gap-1">
          <Button asChild size="sm">
            <Link to={user ? "/explorer" : "/auth"}>
              {user ? "Continue" : "Get started"}
              <ArrowRight className="size-4" />
            </Link>
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6">
        {/* Hero */}
        <section className="py-24 sm:py-32">
          <p className="font-mono text-xs tracking-wide text-muted-foreground uppercase">
            Omni Drive
          </p>
          <h1 className="mt-5 text-4xl leading-[1.08] font-semibold sm:text-5xl">
            One workspace for
            <br />
            <span className="text-primary">every storage account.</span>
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground">
            ODrive brings your cloud accounts together in one place — the same files, the same
            actions, no matter where they actually live.
          </p>

          <div className="mt-9 flex flex-wrap items-center gap-3">
            <Button asChild size="lg">
              <Link to={user ? "/onboarding" : "/auth"}>
                {user ? "Continue setup" : "Start free"}
                <ArrowRight className="size-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="ghost">
              <Link to="/explorer">See the workspace</Link>
            </Button>
          </div>

          <ul className="mt-12 space-y-3">
            {POINTS.map((point) => (
              <li key={point} className="flex items-start gap-3 text-sm text-muted-foreground">
                <Check className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                {point}
              </li>
            ))}
          </ul>
        </section>

        {/* Supported storage */}
        <section className="border-t border-border py-16">
          <h2 className="text-lg font-semibold">Supported storage</h2>
          <p className="mt-2 max-w-lg text-sm text-muted-foreground">
            Every provider speaks the same interface, so anything you learn once works everywhere.
          </p>

          <ul className="mt-8 divide-y divide-border">
            {DESCRIPTORS.map((provider) => (
              <li key={provider.id} className="flex items-center gap-4 py-4">
                <ProviderIcon icon={provider.icon} accent={provider.accent} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{provider.name}</p>
                  <p className="truncate text-xs text-muted-foreground">{provider.tagline}</p>
                </div>
                <ReadinessBadge readiness={providerReadiness.get(provider.id) ?? provider.readiness} />
              </li>
            ))}
          </ul>
        </section>

        {/* Closing */}
        <section className="border-t border-border py-16">
          <h2 className="text-2xl font-semibold">Ready when you are.</h2>
          <p className="mt-3 max-w-lg text-sm text-muted-foreground">
            Sign in with a one-time link — no password to remember, no card required.
          </p>
          <Button asChild size="lg" className="mt-7">
            <Link to={user ? "/explorer" : "/auth"}>
              {user ? "Open workspace" : "Start free"}
              <ArrowRight className="size-4" />
            </Link>
          </Button>
        </section>
      </main>

      <PublicFooter links={footerContent.data ?? []} />
    </div>
  );
}
