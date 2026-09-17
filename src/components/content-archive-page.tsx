import { Link } from "@tanstack/react-router";

import type { ContentEntry, ContentType } from "@/core/content";
import { contentUrl } from "@/core/content";
import { OdriveLogo } from "@/components/odrive-logo";
import { PublicFooter } from "@/components/public-footer";

const titleByType: Record<"blog" | "docs" | "changelog", string> = {
  blog: "Blog",
  docs: "Docs",
  changelog: "Changelogs",
};

const descriptionByType: Record<"blog" | "docs" | "changelog", string> = {
  blog: "Product notes, ideas and updates from ODrive.",
  docs: "Guides and references for running ODrive safely.",
  changelog: "Release notes and product changes.",
};

export function PublicContentArchivePage({
  type,
  entries,
  footerLinks,
}: {
  type: Extract<ContentType, "blog" | "docs" | "changelog">;
  entries: ContentEntry[];
  footerLinks: ContentEntry[];
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
        <p className="font-mono text-xs uppercase tracking-wide text-muted-foreground">Content</p>
        <h1 className="mt-2 text-3xl font-semibold">{titleByType[type]}</h1>
        <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground">
          {descriptionByType[type]}
        </p>

        <div className="mt-10 divide-y divide-border border-y border-border">
          {entries.length === 0 ? (
            <p className="py-8 text-sm text-muted-foreground">No published content yet.</p>
          ) : (
            entries.map((entry) => (
              <a key={entry.id} href={contentUrl(entry)} className="block py-5 hover:bg-muted/30">
                <div className="flex flex-wrap items-baseline justify-between gap-3">
                  <h2 className="text-base font-semibold">{entry.title}</h2>
                  {entry.publishedAt ? (
                    <span className="font-mono text-xs text-muted-foreground">
                      {new Date(entry.publishedAt).toLocaleDateString()}
                    </span>
                  ) : null}
                </div>
                {entry.excerpt ? (
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{entry.excerpt}</p>
                ) : null}
              </a>
            ))
          )}
        </div>
      </main>

      <PublicFooter links={footerLinks} />
    </div>
  );
}
