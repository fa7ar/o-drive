import { createFileRoute } from "@tanstack/react-router";

import { PublicContentArchivePage } from "@/components/content-archive-page";
import { listNavigationContent, listPublishedContent } from "@/core/content";

export const Route = createFileRoute("/c/changelog/")({
  loader: async () => ({
    entries: await listPublishedContent("changelog"),
    footerLinks: await listNavigationContent("footer"),
  }),
  head: () => ({
    meta: [
      { title: "Changelogs - ODrive" },
      { name: "description", content: "Release notes and product changes." },
      { property: "og:title", content: "Changelogs - ODrive" },
      { property: "og:description", content: "Release notes and product changes." },
    ],
  }),
  component: ChangelogArchiveRoute,
});

function ChangelogArchiveRoute() {
  const { entries, footerLinks } = Route.useLoaderData();
  return <PublicContentArchivePage type="changelog" entries={entries} footerLinks={footerLinks} />;
}
