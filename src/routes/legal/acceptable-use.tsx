import { createFileRoute } from "@tanstack/react-router";

import { LegalPage } from "@/components/legal-page";

export const Route = createFileRoute("/legal/acceptable-use")({
  head: () => ({
    meta: [
      { title: "Acceptable Use Policy — ODrive" },
      {
        name: "description",
        content:
          "What you may and may not do with ODrive drives, transfers, and public share links.",
      },
      { property: "og:title", content: "Acceptable Use Policy — ODrive" },
      {
        property: "og:description",
        content: "Rules for drives, transfers, automations, and public share links on ODrive.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AcceptableUseRoute,
});

function AcceptableUseRoute() {
  return (
    <LegalPage title="Acceptable Use Policy" updated="2026-01-01">
      <h2>Principles</h2>
      <p>
        ODrive moves data between storage you already own. You are responsible for everything that
        passes through your workspace, including files exposed via public share links.
      </p>
      <h2>Not permitted</h2>
      <ul>
        <li>Connecting accounts you are not authorised to access.</li>
        <li>Storing or distributing unlawful content, malware, or phishing material.</li>
        <li>Sharing content that infringes someone else&apos;s rights.</li>
        <li>Using automations to circumvent a provider&apos;s rate limits or quotas.</li>
        <li>Probing, scanning, or overloading ODrive infrastructure.</li>
      </ul>
      <h2>Automations and transfers</h2>
      <p>
        Rules run on your behalf. Keep loop protection in place, avoid mirroring the same path in
        both directions, and monitor failures in Jobs and Logs.
      </p>
      <h2>Enforcement</h2>
      <p>
        We may disable a share link, pause an automation, or suspend a workspace that creates legal
        or security risk. Where practical we notify you first.
      </p>
      <h2>Reporting</h2>
      <p>Report abuse to abuse@odrive.app.</p>
    </LegalPage>
  );
}
