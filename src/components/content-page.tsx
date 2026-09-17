import { Link } from "@tanstack/react-router";
import type { ContentEntry } from "@/core/content";
import { FloatingToc, MarkdownRenderer, useMarkdownHeadings } from "@/components/markdown-renderer";
import { OdriveLogo } from "@/components/odrive-logo";
import { PublicFooter } from "@/components/public-footer";

const displayDate = (value: string) => value.slice(0, 10);

export function PublicContentPage({ entry, footerLinks = [] }: { entry: ContentEntry; footerLinks?: ContentEntry[] }) {
  const headings = useMarkdownHeadings(entry.markdown);
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border"><div className="mx-auto flex h-16 max-w-3xl items-center justify-between px-6"><Link to="/"><OdriveLogo /></Link><Link to="/" className="text-sm text-muted-foreground hover:text-foreground">Back to home</Link></div></header>
      <main className="mx-auto grid max-w-6xl gap-8 px-6 py-14 xl:grid-cols-[12rem_minmax(0,48rem)_12rem]">
        <FloatingToc headings={headings} />
        <article className="min-w-0">
          <p className="font-mono text-xs uppercase tracking-wide text-muted-foreground">{entry.type}</p>
          <h1 className="mt-2 text-3xl font-semibold">{entry.title}</h1>
          {entry.publishedAt ? <p className="mt-2 font-mono text-xs text-muted-foreground">last updated {displayDate(entry.publishedAt)}</p> : null}
          {entry.excerpt ? <p className="mt-5 text-sm leading-relaxed text-muted-foreground">{entry.excerpt}</p> : null}
          <div className="mt-8"><MarkdownRenderer markdown={entry.markdown} /></div>
        </article>
      </main>
      <PublicFooter links={footerLinks} />
    </div>
  );
}
