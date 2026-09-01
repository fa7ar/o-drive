import { createFileRoute } from "@tanstack/react-router";

import { LegalPage } from "@/components/legal-page";

export const Route = createFileRoute("/legal/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy — ODrive" },
      {
        name: "description",
        content:
          "How ODrive handles your data: encrypted provider credentials, metadata-only indexing, and no file content retention.",
      },
      { property: "og:title", content: "Privacy Policy — ODrive" },
      {
        property: "og:description",
        content: "Encrypted credentials, metadata-only indexing, no file content retention.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PrivacyRoute,
});

function PrivacyRoute() {
  return (
    <LegalPage title="Privacy Policy" updated="2026-01-01">
      <h2>What we store</h2>
      <p>
        ODrive is a control plane for storage you already own. We store your account email, workspace
        settings, drive configuration, file <em>metadata</em> (names, paths, sizes, timestamps) and
        operational logs. Provider credentials are encrypted with AES-GCM envelope encryption before
        they are persisted, and are only decrypted inside a server-side operation.
      </p>
      <h2>What we never store</h2>
      <ul>
        <li>File contents — transfers stream through and are not retained.</li>
        <li>Plaintext credentials, tokens, or share passwords (hashed with PBKDF2).</li>
        <li>Raw IP addresses in share access logs — they are salted and hashed.</li>
      </ul>
      <h2>Third-party providers</h2>
      <p>
        When you connect a drive, ODrive acts on your behalf against that provider using the scopes
        you granted. Their handling of your files is governed by their own policy. You can revoke a
        connection at any time from Drives, which deletes the stored credential immediately.
      </p>
      <h2>Retention</h2>
      <p>
        Operational logs are retained for 30 days, share access logs for 90 days, and trashed
        metadata for the retention window configured in your workspace settings. Deleting your
        workspace deletes all associated records.
      </p>
      <h2>Contact</h2>
      <p>Privacy requests: privacy@odrive.app.</p>
    </LegalPage>
  );
}
