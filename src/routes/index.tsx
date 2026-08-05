import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Boxes, GitBranch, Layers, Lock } from "lucide-react";

import { DESCRIPTORS } from "@/adapters";
import { OdriveLogo } from "@/components/odrive-logo";
import { ProviderIcon } from "@/components/provider-icon";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "ODrive — Omni Drive. Every Storage." },
      {
        name: "description",
        content:
          "One adapter-based API for Google Drive, OneDrive, Telegram, Cloudflare R2 and Amazon S3. Connect accounts, browse files and move data with zero vendor lock-in.",
      },
      { property: "og:title", content: "ODrive — Omni Drive. Every Storage." },
      {
        property: "og:description",
        content:
          "A vendor-agnostic storage abstraction layer for Google Drive, OneDrive, Telegram, R2 and S3.",
      },
    ],
  }),
  component: Home,
});

const PRINCIPLES = [
  {
    icon: Layers,
    title: "Adapter pattern",
    body: "Every provider implements one StorageProvider interface. Swap or add vendors without touching business logic.",
  },
  {
    icon: GitBranch,
    title: "Repository pattern",
    body: "Services talk to abstract repositories only. The in-memory store swaps for SQL with no UI changes.",
  },
  {
    icon: Lock,
    title: "Sealed credentials",
    body: "Provider tokens pass through a Secret Manager interface before they ever reach persistence.",
  },
  {
    icon: Boxes,
    title: "Modular monolith",
    body: "Single deployable unit, clean seams: core, storage, auth, database, adapters.",
  },
];

function Home() {
  const { user } = useAuth();

  return (
    <div className="min-h-screen">
      <header className="border-b border-border">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
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
        </div>
      </header>

      <section className="relative overflow-hidden border-b border-border">
        <div className="absolute inset-0 grid-backdrop opacity-60" aria-hidden />
        <div className="absolute inset-0 hero-glow" aria-hidden />
        <div className="relative mx-auto max-w-6xl px-6 py-24 text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 font-mono text-xs text-muted-foreground">
            storage abstraction layer · v0.1 mvp
          </span>
          <h1 className="mx-auto mt-6 max-w-3xl text-5xl leading-[1.05] font-semibold sm:text-6xl">
            Omni Drive.
            <br />
            <span className="text-primary">Every Storage.</span>
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-base text-muted-foreground">
            Connect unlimited accounts across five providers and manage them through a single
            consistent API and UI. No vendor lock-in, no rewrite when you add the sixth.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Button asChild size="lg">
              <Link to="/auth">
                Start with a magic link
                <ArrowRight className="size-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link to="/dashboard">Explore the dashboard</Link>
            </Button>
          </div>

          <div className="mx-auto mt-16 grid max-w-4xl gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {DESCRIPTORS.map((provider) => (
              <div
                key={provider.id}
                className="panel flex flex-col items-center gap-3 px-4 py-6 transition-shadow hover:shadow-lift"
              >
                <ProviderIcon icon={provider.icon} accent={provider.accent} size="lg" />
                <div>
                  <p className="text-sm font-semibold">{provider.name}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{provider.tagline}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-20">
        <h2 className="text-center text-2xl font-semibold">Built to be replaced, part by part</h2>
        <div className="mt-10 grid gap-4 sm:grid-cols-2">
          {PRINCIPLES.map((principle) => (
            <div key={principle.title} className="panel p-6">
              <principle.icon className="size-5 text-primary" strokeWidth={1.8} />
              <p className="mt-4 font-display font-semibold">{principle.title}</p>
              <p className="mt-1.5 text-sm text-muted-foreground">{principle.body}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-border bg-surface">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-10">
          <OdriveLogo />
          <nav className="flex flex-wrap gap-6 text-sm text-muted-foreground">
            <a href="https://docs.lovable.dev" className="hover:text-foreground">
              Documentation
            </a>
            <Link to="/" className="hover:text-foreground">
              Privacy
            </Link>
            <Link to="/" className="hover:text-foreground">
              Terms
            </Link>
            <a href="https://github.com" className="hover:text-foreground">
              GitHub
            </a>
          </nav>
        </div>
      </footer>
    </div>
  );
}
