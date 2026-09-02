import { createFileRoute } from "@tanstack/react-router";

import { LegalPage } from "@/components/legal-page";

export const Route = createFileRoute("/legal/data-deletion")({
  head: () => ({
    meta: [
      { title: "Data Deletion — ODrive" },
      {
        name: "description",
        content:
          "How to disconnect drives, revoke credentials, and permanently delete your ODrive workspace data.",
      },
      { property: "og:title", content: "Data Deletion — ODrive" },
      {
        property: "og:description",
        content: "Disconnect drives, revoke credentials, and delete your workspace data.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: DataDeletionRoute,
});

function DataDeletionRoute() {
  return (
    <LegalPage title="Data Deletion" updated="2026-01-01">
      <h2>Delete a single drive</h2>
      <p>
        Open <strong>Drives</strong>, choose the drive, and select disconnect. The encrypted
        credential is destroyed immediately and its indexed metadata is removed. Files at the
        provider are untouched.
      </p>
      <h2>Delete a share link</h2>
      <p>
        Open <strong>Shares</strong> and revoke the link. The token stops resolving right away;
        access logs are retained for 90 days for audit purposes.
      </p>
      <h2>Delete your whole workspace</h2>
      <ul>
        <li>Go to Settings and choose delete workspace, or</li>
        <li>Email deletion@odrive.app from your account address.</li>
      </ul>
      <p>
        Deletion removes credentials, drive configuration, file metadata, shares, automations, and
        job history. It cannot be undone.
      </p>
      <h2>Timelines</h2>
      <p>
        Credentials and metadata are deleted immediately. Backups and operational logs age out
        within 30 days.
      </p>
      <h2>Contact</h2>
      <p>Questions: privacy@odrive.app.</p>
    </LegalPage>
  );
}
