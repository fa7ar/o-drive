import { createFileRoute } from "@tanstack/react-router";

import { PublicContentArchivePage } from "@/components/content-archive-page";
import { listNavigationContent, listPublishedContent } from "@/core/content";

export const Route = createFileRoute("/c/docs")({
  loader: async () => ({
    entries: await listPublishedContent("docs"),
    footerLinks: await listNavigationContent("footer"),
  }),
  head: () => ({
    meta: [
      { title: "Docs - ODrive" },
      { name: "description", content: "Guides and references for running ODrive safely." },
      { property: "og:title", content: "Docs - ODrive" },
      { property: "og:description", content: "Guides and references for running ODrive safely." },
    ],
  }),
  component: DocsArchiveRoute,
});

function DocsArchiveRoute() {
  const { entries, footerLinks } = Route.useLoaderData();
  return <PublicContentArchivePage type="docs" entries={entries} footerLinks={footerLinks} />;
}
