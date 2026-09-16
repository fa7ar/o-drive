import { createFileRoute } from "@tanstack/react-router";
import { PublicContentPage } from "@/components/content-page";
import type { ContentEntry } from "@/core/content";
import { contentMeta, getPublishedContentByRoute, listNavigationContent } from "@/core/content";

export const Route = createFileRoute("/legal/$slug")({
  loader: async ({ params }) => {
    const entry = await getPublishedContentByRoute("legal", params.slug);
    const footerLinks = await listNavigationContent("footer");
    return { entry, footerLinks };
  },
  head: ({ loaderData }) => {
    const entry = loaderData?.entry as ContentEntry | null | undefined;
    const meta = entry ? contentMeta(entry) : { title: "Content not found - ODrive", description: "Content not found", ogTitle: "Content not found", ogDescription: "Content not found", robots: "noindex,nofollow" };
    return { meta: [
      { title: meta.title },
      { name: "description", content: meta.description },
      { name: "robots", content: meta.robots },
      { property: "og:title", content: meta.ogTitle },
      { property: "og:description", content: meta.ogDescription },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: entry?.ogImageUrl ? "summary_large_image" : "summary" },
    ] };
  },
  component: ContentRoute,
});

function ContentRoute() {
  const { entry, footerLinks } = Route.useLoaderData();
  if (!entry) {
    return <div className="mx-auto max-w-3xl px-6 py-20"><h1 className="text-2xl font-semibold">Content not found</h1><p className="mt-2 text-sm text-muted-foreground">This content is either unpublished or unavailable.</p></div>;
  }
  return <PublicContentPage entry={entry} footerLinks={footerLinks} />;
}