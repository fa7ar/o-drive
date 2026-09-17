import { createFileRoute } from "@tanstack/react-router";

import { PublicContentArchivePage } from "@/components/content-archive-page";
import { listNavigationContent, listPublishedContent } from "@/core/content";

export const Route = createFileRoute("/c/blog")({
  loader: async () => ({
    entries: await listPublishedContent("blog"),
    footerLinks: await listNavigationContent("footer"),
  }),
  head: () => ({
    meta: [
      { title: "Blog - ODrive" },
      { name: "description", content: "Product notes, ideas and updates from ODrive." },
      { property: "og:title", content: "Blog - ODrive" },
      { property: "og:description", content: "Product notes, ideas and updates from ODrive." },
    ],
  }),
  component: BlogArchiveRoute,
});

function BlogArchiveRoute() {
  const { entries, footerLinks } = Route.useLoaderData();
  return <PublicContentArchivePage type="blog" entries={entries} footerLinks={footerLinks} />;
}
