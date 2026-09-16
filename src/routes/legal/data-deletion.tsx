import { createFileRoute } from "@tanstack/react-router";
import { PublicContentPage } from "@/components/content-page";
import type { ContentEntry } from "@/core/content";
import { contentMeta, getPublishedContentByRoute, listNavigationContent } from "@/core/content";

export const Route = createFileRoute("/legal/data-deletion")({
  loader: async () => {
    const entry = await getPublishedContentByRoute("legal", "data-deletion");
    const footerLinks = await listNavigationContent("footer");
    return { entry, footerLinks };
  },
  head: ({ loaderData }) => {
    const entry = loaderData?.entry as ContentEntry | null | undefined;
    const meta = entry ? contentMeta(entry) : { title: "Legal - ODrive", description: "ODrive legal document", ogTitle: "Legal", ogDescription: "ODrive legal document", robots: "noindex,nofollow" };
    return { meta: [
      { title: meta.title },
      { name: "description", content: meta.description },
      { name: "robots", content: meta.robots },
      { property: "og:title", content: meta.ogTitle },
      { property: "og:description", content: meta.ogDescription },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ] };
  },
  component: LegalContentRoute,
});

function LegalContentRoute() {
  const { entry, footerLinks } = Route.useLoaderData();
  if (!entry) return <div className="mx-auto max-w-3xl px-6 py-20"><h1 className="text-2xl font-semibold">Legal content not found</h1></div>;
  return <PublicContentPage entry={entry} footerLinks={footerLinks} />;
}