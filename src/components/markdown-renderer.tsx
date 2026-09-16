import { useEffect, useMemo, useState } from "react";
type Heading = { id: string; text: string; level: 2 | 3 };
const esc = (v: string) => v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const slug = (v: string) => v.toLowerCase().replace(/[^a-z0-9\s-]/g, "").trim().replace(/\s+/g, "-").slice(0, 80);
const inline = (v: string) => esc(v).replace(/`([^`]+)`/g, "<code>$1</code>").replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>").replace(/_([^_]+)_/g, "<em>$1</em>").replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
const yt = (v: string) => v.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{6,})/)?.[1] ?? null;

export function parseMarkdown(markdown: string): { html: string; headings: Heading[] } {
  const headings: Heading[] = [];
  const html: string[] = [];
  let paragraph: string[] = [];
  let list: "ul" | "ol" | null = null;
  let code: string[] | null = null;
  const flushP = () => { if (paragraph.length) { html.push("<p>" + inline(paragraph.join(" ")) + "</p>"); paragraph = []; } };
  const closeList = () => { if (list) { html.push("</" + list + ">"); list = null; } };
  for (const line of markdown.replace(/\r\n/g, "\n").split("\n")) {
    if (line.startsWith("```")) { if (code) { html.push("<pre><code>" + esc(code.join("\n")) + "</code></pre>"); code = null; } else { flushP(); closeList(); code = []; } continue; }
    if (code) { code.push(line); continue; }
    const t = line.trim();
    if (!t) { flushP(); closeList(); continue; }
    if (t === "---") { flushP(); closeList(); html.push("<hr />"); continue; }
    const h = t.match(/^(##|###)\s+(.+)$/);
    if (h) { flushP(); closeList(); const level = h[1] === "##" ? 2 : 3; const text = h[2]!; const base = slug(text) || "section"; const id = headings.some((x) => x.id === base) ? base + "-" + (headings.length + 1) : base; headings.push({ id, text, level }); html.push("<h" + level + " id=\"" + id + "\">" + inline(text) + "</h" + level + ">"); continue; }
    const q = t.match(/^>\s+(.+)$/); if (q) { flushP(); closeList(); html.push("<blockquote>" + inline(q[1]!) + "</blockquote>"); continue; }
    const video = yt(t); if (video) { flushP(); closeList(); html.push('<div class="embed"><iframe src="https://www.youtube.com/embed/' + video + '" title="YouTube video" loading="lazy" allowfullscreen></iframe></div>'); continue; }
    if (/^https?:\/\/.*\.(png|jpg|jpeg|gif|webp)$/i.test(t)) { flushP(); closeList(); html.push('<img src="' + esc(t) + '" alt="" loading="lazy" />'); continue; }
    const ul = t.match(/^[-*]\s+(.+)$/); const ol = t.match(/^\d+\.\s+(.+)$/);
    if (ul || ol) { flushP(); const next = ol ? "ol" : "ul"; if (list !== next) { closeList(); list = next; html.push("<" + next + ">"); } html.push("<li>" + inline((ul ?? ol)![1]!) + "</li>"); continue; }
    paragraph.push(t);
  }
  flushP(); closeList();
  return { html: html.join("\n"), headings };
}

export function MarkdownRenderer({ markdown }: { markdown: string }) {
  const rendered = useMemo(() => parseMarkdown(markdown), [markdown]);
  return <div className="space-y-5 text-sm leading-relaxed text-muted-foreground [&_.embed]:aspect-video [&_.embed]:overflow-hidden [&_.embed]:rounded-lg [&_.embed_iframe]:h-full [&_.embed_iframe]:w-full [&_a]:text-primary [&_a]:underline [&_blockquote]:border-l-2 [&_blockquote]:border-primary [&_blockquote]:pl-4 [&_blockquote]:italic [&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_h2]:scroll-mt-20 [&_h2]:font-display [&_h2]:text-base [&_h2]:font-semibold [&_h2]:text-foreground [&_h3]:scroll-mt-20 [&_h3]:font-display [&_h3]:text-sm [&_h3]:font-semibold [&_h3]:text-foreground [&_hr]:border-border [&_img]:rounded-lg [&_img]:border [&_img]:border-border [&_li]:ml-5 [&_ol_li]:list-decimal [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:bg-muted [&_pre]:p-4 [&_ul_li]:list-disc" dangerouslySetInnerHTML={{ __html: rendered.html }} />;
}
export function useMarkdownHeadings(markdown: string) { return useMemo(() => parseMarkdown(markdown).headings, [markdown]); }
export function FloatingToc({ headings }: { headings: Heading[] }) {
  const [active, setActive] = useState(headings[0]?.id ?? "");
  useEffect(() => { if (headings.length < 3) return; const observer = new IntersectionObserver((entries) => { const visible = entries.find((entry) => entry.isIntersecting); if (visible?.target.id) setActive(visible.target.id); }, { rootMargin: "-20% 0px -70% 0px" }); headings.forEach((heading) => { const node = document.getElementById(heading.id); if (node) observer.observe(node); }); return () => observer.disconnect(); }, [headings]);
  if (headings.length < 3) return null;
  return <aside className="hidden xl:block"><nav className="sticky top-24 w-48 space-y-1 text-xs" aria-label="Table of contents"><p className="mb-2 font-mono text-[11px] uppercase tracking-wide text-muted-foreground">On this page</p>{headings.map((heading) => <a key={heading.id} href={"#" + heading.id} className={"block rounded px-2 py-1 " + (heading.level === 3 ? "pl-5 " : "") + (active === heading.id ? "bg-card text-foreground" : "text-muted-foreground hover:text-foreground")}>{heading.text}</a>)}</nav></aside>;
}