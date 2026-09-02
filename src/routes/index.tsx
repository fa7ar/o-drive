import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";

import { DESCRIPTORS } from "@/adapters";
import { OdriveLogo } from "@/components/odrive-logo";
import { ProviderIcon } from "@/components/provider-icon";
import { ReadinessBadge } from "@/components/readiness-badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";

const TITLE = "Omni Drive — one workspace for every storage account";
const DESCRIPTION =
  "Connect unlimited accounts across providers and manage them seamlessly in a single workspace. Google Drive and Cloudflare R2 are production ready today.";

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

  return (
    <div className="min-h-screen">
      {/* 1 — Hero */}
      <section className="relative overflow-hidden border-b border-border">
        <div className="absolute inset-0 grid-backdrop opacity-60" aria-hidden />
        <div className="absolute inset-0 hero-glow" aria-hidden />
        <div className="relative mx-auto max-w-6xl px-6">
          <header className="flex h-16 items-center justify-between">
            <OdriveLogo />
            <div className="flex items-center gap-2">
              <Button asChild variant="ghost" size="sm">
                <Link to="/auth">Sign in</Link>
              </Button>
              <Button asChild size="sm">
                <Link to={user ? "/dashboard" : "/auth"}>
                  {user ? "Open dashboard" : "Get started"}
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
            </div>
          </header>

          <div className="py-24 text-center">
            <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 font-mono text-xs text-muted-foreground">
              multiple storage layer
            </span>
            <h1 className="mx-auto mt-6 max-w-3xl text-5xl leading-[1.05] font-semibold sm:text-6xl">
              Omni <span className="text-primary">Drive</span>
            </h1>
            <p className="mx-auto mt-5 max-w-xl text-base text-muted-foreground">
              Connect unlimited accounts across providers and manage them seamlessly in single
              workspace.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Button asChild size="lg">
                <Link to={user ? "/onboarding" : "/auth"}>
                  {user ? "Continue setup" : "Start with a magic link"}
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link to="/dashboard">Explore the workspace</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* 2 — Supported storage */}
      <section className="mx-auto max-w-6xl px-6 py-20">
        <h2 className="text-center text-2xl font-semibold">Supported storage</h2>
        <p className="mx-auto mt-2 max-w-lg text-center text-sm text-muted-foreground">
          Every provider implements the same adapter contract, so features you learn once work
          everywhere.
        </p>
        <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {DESCRIPTORS.map((provider) => (
            <div key={provider.id} className="panel flex items-start gap-4 p-5">
              <ProviderIcon icon={provider.icon} accent={provider.accent} size="lg" />
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-semibold">{provider.name}</p>
                  <ReadinessBadge readiness={provider.readiness} />
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{provider.tagline}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 3 — Footer */}
      <footer className="border-t border-border bg-surface">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-10">
          <div className="flex items-center gap-3">
            <OdriveLogo />
            <span className="text-sm text-muted-foreground">
              by 
              <a
                href="https://www.linkedin.com/in/fajartri"
                target="_blank"
                rel="noopener noreferrer"
              >
                Fajar Tri
              </a>
            </span>
          </div>
          <nav className="flex flex-wrap gap-6 text-sm text-muted-foreground">
            <Link to="/legal/privacy" className="hover:text-foreground">
              Privacy
            </Link>
            <Link to="/legal/terms" className="hover:text-foreground">
              Terms
            </Link>
            <Link to="/legal/acceptable-use" className="hover:text-foreground">
              Acceptable use
            </Link>
            <Link to="/legal/data-deletion" className="hover:text-foreground">
              Data deletion
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
