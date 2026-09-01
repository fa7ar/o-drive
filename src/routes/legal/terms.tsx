import { createFileRoute } from "@tanstack/react-router";

import { LegalPage } from "@/components/legal-page";

export const Route = createFileRoute("/legal/terms")({
  head: () => ({
    meta: [
      { title: "Terms of Service — ODrive" },
      {
        name: "description",
        content:
          "The agreement covering ODrive workspaces: your responsibilities, provider limits, availability, and account termination.",
      },
      { property: "og:title", content: "Terms of Service — ODrive" },
      {
        property: "og:description",
        content: "Workspace terms: responsibilities, provider limits, availability, termination.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TermsRoute,
});

function TermsRoute() {
  return (
    <LegalPage title="Terms of Service" updated="2026-01-01">
      <h2>The service</h2>
      <p>
        ODrive provides a unified control plane over storage accounts you own or are authorised to
        use. You keep ownership of your data at all times; ODrive stores no file contents.
      </p>
      <h2>Your responsibilities</h2>
      <ul>
        <li>Only connect accounts you are authorised to access.</li>
        <li>Keep your sign-in email secure — access is granted by magic link.</li>
        <li>Comply with each connected provider&apos;s own terms and rate limits.</li>
        <li>Do not use ODrive to distribute unlawful content via public share links.</li>
      </ul>
      <h2>Availability</h2>
      <p>
        We target high availability but ODrive depends on third-party providers. Transfers and
        automations retry with backoff; failures are surfaced in Jobs and Logs. Beta providers are
        marked in the UI and are excluded from availability commitments.
      </p>
      <h2>Termination</h2>
      <p>
        You may delete your workspace at any time. We may suspend accounts that abuse the service,
        create security risk, or violate the acceptable use policy.
      </p>
      <h2>Liability</h2>
      <p>
        ODrive is provided &quot;as is&quot;. To the extent permitted by law, we are not liable for
        indirect or consequential loss, including data loss originating at a connected provider.
      </p>
    </LegalPage>
  );
}
