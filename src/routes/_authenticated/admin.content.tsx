import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { AdminNav } from "@/components/admin-nav";
import { AppShell } from "@/components/app-shell";
import { MarkdownRenderer } from "@/components/markdown-renderer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type { ContentEntry, ContentType } from "@/core/content";
import { contentUrl, saveContent } from "@/core/content";
import { contentQuery } from "@/lib/queries";

export const Route = createFileRoute("/_authenticated/admin/content")({
  head: () => ({
    meta: [
      { title: "Content - ODrive admin" },
      { name: "description", content: "Unified Markdown content management for pages, blog, docs, changelog and legal content." },
      { property: "og:title", content: "Content - ODrive admin" },
      { property: "og:description", content: "Unified public content management." },
    ],
  }),
  component: AdminContentPage,
});

const TYPES: Array<{ value: ContentType; label: string }> = [
  { value: "page", label: "Pages" },
  { value: "blog", label: "Blog" },
  { value: "docs", label: "Docs" },
  { value: "changelog", label: "Changelog" },
  { value: "legal", label: "Legal" },
];

const blank = (): ContentEntry => ({
  id: "", title: "Untitled page", slug: "untitled-page", type: "page", excerpt: "", markdown: "## New section\n\nStart writing here.",
  status: "draft", publishedAt: null, showInHeader: false, showInFooter: false, navOrder: 999, index: true, follow: true, updatedAt: new Date().toISOString(),
});

function applyFormat(markdown: string, format: string) {
  if (format === "h2") return markdown + "\n\n## Heading\n";
  if (format === "h3") return markdown + "\n\n### Subheading\n";
  if (format === "bold") return markdown + "\n\n**bold text**";
  if (format === "italic") return markdown + "\n\n_italic text_";
  if (format === "link") return markdown + "\n\n[Link label](https://example.com)";
  if (format === "image") return markdown + "\n\nhttps://example.com/image.jpg";
  if (format === "youtube") return markdown + "\n\nhttps://www.youtube.com/watch?v=VIDEO_ID";
  if (format === "ul") return markdown + "\n\n- List item";
  if (format === "ol") return markdown + "\n\n1. List item";
  if (format === "quote") return markdown + "\n\n> Quote";
  if (format === "code") return markdown + "\n\n`inline code`";
  if (format === "block") return markdown + "\n\n```\ncode block\n```";
  if (format === "hr") return markdown + "\n\n---";
  return markdown;
}

function AdminContentPage() {
  const queryClient = useQueryClient();
  const content = useQuery(contentQuery);
  const [type, setType] = useState<ContentType | "all">("all");
  const [mode, setMode] = useState<"markdown" | "preview">("markdown");
  const filtered = useMemo(() => (content.data ?? []).filter((entry) => type === "all" || entry.type === type), [content.data, type]);
  const [draft, setDraft] = useState<ContentEntry | null>(null);
  const current = draft ?? filtered[0] ?? blank();

  const save = useMutation({
    mutationFn: saveContent,
    onSuccess: (saved) => {
      setDraft(saved);
      void queryClient.invalidateQueries({ queryKey: ["content"] });
      toast.success("Content saved");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const update = (patch: Partial<ContentEntry>) => setDraft((previous) => ({ ...(previous ?? current), ...patch }));

  return (
    <AppShell title="Content" description="One Markdown workflow for pages, blog, docs, changelog and legal content.">
      <AdminNav />
      <div className="grid gap-4 lg:grid-cols-[18rem_minmax(0,1fr)]">
        <aside className="panel p-3">
          <div>
            <Label htmlFor="content-filter">Filter</Label>
            <select
              id="content-filter"
              className="mt-2 h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={type}
              onChange={(event) => setType(event.target.value as ContentType | "all")}
            >
              <option value="all">All content</option>
              {TYPES.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </div>
          <Button className="mt-3 w-full" size="sm" onClick={() => setDraft(blank())}>New content</Button>
          <div className="mt-3 divide-y divide-border">
            {filtered.map((entry) => (
              <button key={entry.id} type="button" className="block w-full px-2 py-3 text-left hover:bg-muted/50" onClick={() => setDraft(entry)}>
                <span className="block truncate text-sm font-medium">{entry.title}</span>
                <span className="mt-1 block text-xs text-muted-foreground">{entry.type} | {entry.status}</span>
              </button>
            ))}
          </div>
        </aside>

        <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_18rem]">
          <div className="panel p-5">
            <div className="grid gap-3 sm:grid-cols-2">
              <div><Label>Title</Label><Input value={current.title} onChange={(event) => update({ title: event.target.value })} /></div>
              <div><Label>Slug</Label><Input value={current.slug} onChange={(event) => update({ slug: event.target.value })} /></div>
              <div><Label>Content type</Label><select className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm" value={current.type} onChange={(event) => update({ type: event.target.value as ContentType })}>{TYPES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></div>
              <div><Label>Status</Label><select className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm" value={current.status} onChange={(event) => update({ status: event.target.value as ContentEntry["status"], publishedAt: event.target.value === "published" ? current.publishedAt ?? new Date().toISOString() : null })}><option value="draft">Draft</option><option value="published">Published</option></select></div>
            </div>
            <div className="mt-3"><Label>Excerpt</Label><Input value={current.excerpt} onChange={(event) => update({ excerpt: event.target.value })} /></div>
            <div className="mt-4 rounded-lg border border-border bg-surface">
              <div className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-2">
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    className={`rounded px-2 py-0.5 text-xs ${mode === "markdown" ? "bg-card text-foreground shadow-xs" : "text-muted-foreground"}`}
                    onClick={() => setMode("markdown")}
                  >
                    Markdown
                  </button>
                  <button
                    type="button"
                    className={`rounded px-2 py-0.5 text-xs ${mode === "preview" ? "bg-card text-foreground shadow-xs" : "text-muted-foreground"}`}
                    onClick={() => setMode("preview")}
                  >
                    Preview
                  </button>
                </div>
                <span className="text-xs text-muted-foreground">|</span>
                <div className="flex flex-wrap items-center gap-1 text-xs">
                  {["h2","h3","bold","italic","link","image","youtube","ul","ol","quote","code","block","hr"].map((item, index) => (
                    <span key={item} className="inline-flex items-center gap-1">
                      {index > 0 ? <span className="text-muted-foreground">|</span> : null}
                      <button
                        type="button"
                        className="rounded px-1.5 py-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                        onClick={() => update({ markdown: applyFormat(current.markdown, item) })}
                      >
                        {item}
                      </button>
                    </span>
                  ))}
                </div>
              </div>
              {mode === "markdown" ? (
                <textarea
                  className="min-h-[34rem] w-full resize-y border-0 bg-background p-4 font-mono text-sm outline-none"
                  value={current.markdown}
                  onChange={(event) => update({ markdown: event.target.value })}
                />
              ) : (
                <div className="min-h-[34rem] bg-background p-4">
                  <MarkdownRenderer markdown={current.markdown} />
                </div>
              )}
            </div>
            <div className="mt-4 flex items-center justify-between gap-3">
              <p className="truncate font-mono text-xs text-muted-foreground">{current.status === "published" ? contentUrl(current) : "Draft content is not publicly accessible"}</p>
              <Button onClick={() => save.mutate(current)} disabled={save.isPending}>Save content</Button>
            </div>
          </div>

          <aside className="panel h-fit p-5">
            <h2 className="text-sm font-semibold">Navigation</h2>
            <label className="mt-3 flex items-center justify-between gap-3 text-sm">Show in header<Switch checked={current.showInHeader} onCheckedChange={(checked) => update({ showInHeader: checked })} /></label>
            <label className="mt-3 flex items-center justify-between gap-3 text-sm">Show in footer<Switch checked={current.showInFooter} onCheckedChange={(checked) => update({ showInFooter: checked })} /></label>
            <div className="mt-3"><Label>Navigation label</Label><Input value={current.navLabel ?? ""} onChange={(event) => update({ navLabel: event.target.value })} /></div>
            <div className="mt-3"><Label>Order</Label><Input value={String(current.navOrder)} onChange={(event) => update({ navOrder: Number(event.target.value) || 0 })} /></div>

            <h2 className="mt-6 text-sm font-semibold">SEO</h2>
            <div className="mt-3"><Label>SEO title</Label><Input value={current.seoTitle ?? ""} onChange={(event) => update({ seoTitle: event.target.value })} /></div>
            <div className="mt-3"><Label>Meta description</Label><textarea className="mt-2 min-h-20 w-full rounded-md border border-input bg-background p-2 text-sm" value={current.metaDescription ?? ""} onChange={(event) => update({ metaDescription: event.target.value })} /></div>
            <div className="mt-3"><Label>Canonical URL</Label><Input value={current.canonicalUrl ?? ""} onChange={(event) => update({ canonicalUrl: event.target.value })} /></div>
            <label className="mt-3 flex items-center justify-between gap-3 text-sm">Index<Switch checked={current.index} onCheckedChange={(checked) => update({ index: checked })} /></label>
            <label className="mt-3 flex items-center justify-between gap-3 text-sm">Follow<Switch checked={current.follow} onCheckedChange={(checked) => update({ follow: checked })} /></label>

            <h2 className="mt-6 text-sm font-semibold">OpenGraph</h2>
            <div className="mt-3"><Label>OG title</Label><Input value={current.ogTitle ?? ""} onChange={(event) => update({ ogTitle: event.target.value })} /></div>
            <div className="mt-3"><Label>OG description</Label><textarea className="mt-2 min-h-20 w-full rounded-md border border-input bg-background p-2 text-sm" value={current.ogDescription ?? ""} onChange={(event) => update({ ogDescription: event.target.value })} /></div>
            <div className="mt-3"><Label>OG image URL</Label><Input value={current.ogImageUrl ?? ""} onChange={(event) => update({ ogImageUrl: event.target.value })} /></div>
          </aside>
        </section>
      </div>
    </AppShell>
  );
}
