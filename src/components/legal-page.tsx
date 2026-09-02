import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";

import { OdriveLogo } from "@/components/odrive-logo";

/** Shared chrome for the public legal documents. */
export function LegalPage({
  title,
  updated,
  children,
}: {
  title: string;
  updated: string;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="mx-auto flex h-16 max-w-3xl items-center justify-between px-6">
          <Link to="/">
            <OdriveLogo />
          </Link>
          <Link to="/" className="text-sm text-muted-foreground hover:text-foreground">
            Back to home
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-6 py-14">
        <h1 className="text-3xl font-semibold">{title}</h1>
        <p className="mt-2 font-mono text-xs text-muted-foreground">last updated {updated}</p>
        <div className="mt-8 space-y-6 text-sm leading-relaxed text-muted-foreground [&_h2]:font-display [&_h2]:text-base [&_h2]:font-semibold [&_h2]:text-foreground [&_li]:ml-5 [&_li]:list-disc">
          {children}
        </div>
      </main>
      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-4 px-6 py-8">
          <div className="flex items-center gap-3">
            <OdriveLogo />
            <span className="text-sm text-muted-foreground">
              by Fajar Tri (
              <a
                href="https://www.linkedin.com/in/fajartri"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                live link
              </a>
              )
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
