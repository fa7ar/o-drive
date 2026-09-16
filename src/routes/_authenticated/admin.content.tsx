import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { AdminNav } from "@/components/admin-nav";
import { AppShell } from "@/components/app-shell";
import { MarkdownRenderer } from "@/components/markdown-renderer";
import { Badge } from "@/components/ui/badge";
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
          <div className="flex flex-wrap gap-1">
            <Button size="sm" variant={type === "all" ? "default" : "secondary"} onClick={() => setType("all")}>All</Button>
            {TYPES.map((item) => <Button key={item.value} size="sm" variant={type === item.value ? "default" : "secondary"} onClick={() => setType(item.value)}>{item.label}</Button>)}
          </div>
          <Button className="mt-3 w-full" size="sm" onClick={() => setDraft(blank())}>New content</Button>
          <div className="mt-3 divide-y divide-border">
            {filtered.map((entry) => (
              <button key={entry.id} type="button" className="block w-full px-2 py-3 text-left hover:bg-muted/50" onClick={() => setDraft(entry)}>
                <span className="block truncate text-sm font-medium">{entry.title}</span>
                <span className="mt-1 flex items-center gap-2 text-xs text-muted-foreground"><Badge variant="outline" className="capitalize">{entry.type}</Badge>{entry.status}</span>
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
            <div className="mt-4 flex flex-wrap gap-1">
              {["h2","h3","bold","italic","link","image","youtube","ul","ol","quote","code","block","hr"].map((item) => <Button key={item} type="button" size="sm" variant="secondary" onClick={() => update({ markdown: applyFormat(current.markdown, item) })}>{item}</Button>)}
            </div>
            <div className="mt-3 grid gap-4 xl:grid-cols-2">
              <div><Label>Markdown</Label><textarea className="mt-2 min-h-[32rem] w-full rounded-md border border-input bg-background p-3 font-mono text-sm" value={current.markdown} onChange={(event) => update({ markdown: event.target.value })} /></div>
              <div><Label>Preview</Label><div className="mt-2 min-h-[32rem] rounded-md border border-border bg-surface p-4"><MarkdownRenderer markdown={current.markdown} /></div></div>
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