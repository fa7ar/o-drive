import { Check, Copy } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";

/**
 * ODrive developer quickstart. Rendered inside /developer → Quickstart.
 * All examples use the real v1 endpoints served by this app.
 */

function CodeBlock({ code, label }: { code: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  return (
    <div className="group relative">
      {label ? (
        <p className="mb-1.5 text-xs font-medium text-muted-foreground">{label}</p>
      ) : null}
      <pre className="overflow-x-auto rounded-md border border-border bg-surface p-3 pr-12 font-mono text-xs leading-relaxed whitespace-pre">
        {code}
      </pre>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        onClick={copy}
        aria-label={copied ? "Copied" : "Copy code"}
        className="absolute top-1.5 right-1.5 h-7 w-7 p-0 opacity-70 hover:opacity-100"
      >
        {copied ? <Check className="size-3.5 text-primary" /> : <Copy className="size-3.5" />}
      </Button>
    </div>
  );
}

function Section({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-20 space-y-3">
      <h2 className="font-display text-base font-semibold">{title}</h2>
      {children}
    </section>
  );
}

function P({ children }: { children: React.ReactNode }) {
  return <p className="text-sm leading-relaxed text-muted-foreground">{children}</p>;
}

function Code({ children }: { children: React.ReactNode }) {
  return (
    <code className="rounded bg-surface px-1.5 py-0.5 font-mono text-xs text-foreground">
      {children}
    </code>
  );
}

const SECTIONS = [
  { id: "basics", label: "API basics" },
  { id: "auth", label: "Authentication" },
  { id: "first-request", label: "First request" },
  { id: "examples", label: "Usage examples" },
  { id: "webhooks", label: "Webhooks" },
  { id: "errors", label: "Error handling" },
  { id: "self-host", label: "Self-hosted deployment" },
  { id: "workers", label: "Cloudflare Workers" },
  { id: "env", label: "Environment variables" },
  { id: "database", label: "Database" },
  { id: "providers", label: "Storage providers" },
  { id: "checklist", label: "Production checklist" },
] as const;

export function DeveloperDocs({ baseUrl }: { baseUrl: string }) {
  return (
    <div className="flex flex-col gap-8 lg:flex-row">
      {/* Section navigation: horizontal scroll on mobile, sticky rail on desktop. */}
      <nav
        aria-label="Quickstart sections"
        className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1 lg:sticky lg:top-20 lg:w-44 lg:shrink-0 lg:flex-col lg:self-start"
      >
        {SECTIONS.map((section) => (
          <a
            key={section.id}
            href={`#${section.id}`}
            className="shrink-0 rounded-md px-2.5 py-1.5 text-xs whitespace-nowrap text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            {section.label}
          </a>
        ))}
      </nav>

      <div className="min-w-0 flex-1 space-y-10">
        <Section id="basics" title="ODrive Public API basics">
          <P>
            The ODrive v1 API is a single REST contract over every connected storage provider —
            Google Drive, Amazon S3 and Cloudflare R2 today. The base URL is{" "}
            <Code>{baseUrl}/api/public/v1</Code>. All requests and responses are JSON except file
            downloads, which stream bytes.
          </P>
          <P>
            Success responses are wrapped as <Code>{"{ \"data\": …, \"meta\"?: … }"}</Code>. List
            endpoints paginate with <Code>cursor</Code> and <Code>limit</Code> (max 100) and return{" "}
            <Code>meta.next_cursor</Code> when more results exist. Every response carries an{" "}
            <Code>X-Request-Id</Code> header — include it when reporting issues.
          </P>
          <P>
            The full machine-readable contract lives at{" "}
            <a
              href="/api/public/v1/openapi.json"
              target="_blank"
              rel="noreferrer"
              className="text-primary hover:underline"
            >
              /api/public/v1/openapi.json
            </a>
            .
          </P>
        </Section>

        <Section id="auth" title="Authentication & API keys">
          <P>
            Create a key under <strong>Developer → API keys</strong>. Keys look like{" "}
            <Code>odv_live_…</Code>, are shown once, stored hashed, and carry only the scopes you
            grant (<Code>drive:read</Code>, <Code>file:read</Code>, <Code>file:write</Code>,{" "}
            <Code>transfer:write</Code>, <Code>share:read</Code>, <Code>webhook:write</Code>). Send
            the key as a Bearer token:
          </P>
          <CodeBlock code={`Authorization: Bearer odv_live_xxxxxxxxxxxxxxxx`} />
          <P>
            Keys are scoped to your workspace — you can only ever see your own drives, files and
            jobs. Rate limits apply per key; when throttled the API returns <Code>429</Code> with a{" "}
            <Code>rate_limited</Code> error code. Rotate or revoke a key at any time from the Keys
            tab.
          </P>
        </Section>

        <Section id="first-request" title="Your first API request">
          <P>Verify the key and see which workspace it belongs to:</P>
          <CodeBlock
            label="curl"
            code={`curl ${baseUrl}/api/public/v1/me \\
  -H "Authorization: Bearer odv_live_xxxxxxxxxxxxxxxx"`}
          />
          <CodeBlock
            label="Response"
            code={`{
  "data": {
    "workspace_id": "9b1d…",
    "key_prefix": "odv_live_4f2a",
    "scopes": ["drive:read", "file:read"]
  },
  "meta": { "request_id": "req_01J…" }
}`}
          />
        </Section>

        <Section id="examples" title="Common API usage examples">
          <P>List drives, then browse a folder (paths are ODrive virtual paths):</P>
          <CodeBlock
            code={`GET /api/public/v1/drives
GET /api/public/v1/drives/{drive_id}/files?path=/&limit=50
GET /api/public/v1/search?q=invoice`}
          />
          <P>Create a folder and upload a file (initiate → chunks → complete):</P>
          <CodeBlock
            code={`POST /api/public/v1/drives/{drive_id}/folders
{ "path": "/reports/2026" }

POST /api/public/v1/uploads
{ "drive_id": "drv_…", "name": "report.pdf", "size_bytes": 91234, "mime_type": "application/pdf" }
# → { "data": { "upload_id": "upl_…", "chunk_size": 8388608 } }

PUT /api/public/v1/uploads/{upload_id}/chunks?offset=0
<binary chunk>

POST /api/public/v1/uploads/{upload_id}/complete
{ "path": "/reports/2026" }`}
          />
          <P>Move, copy, download or trash a file:</P>
          <CodeBlock
            code={`POST /api/public/v1/files/{file_id}/move   { "path": "/archive" }
POST /api/public/v1/files/{file_id}/copy   { "path": "/backups", "name": "report-v2.pdf" }
GET  /api/public/v1/files/{file_id}/download
DELETE /api/public/v1/files/{file_id}`}
          />
          <P>Start a transfer and poll the job:</P>
          <CodeBlock
            code={`POST /api/public/v1/transfers
{ "drive_id": "drv_…", "name": "report.pdf", "direction": "upload", "size_bytes": 91234 }

GET /api/public/v1/jobs/{job_id}
# → { "data": { "status": "running", "progress": 42, … } }`}
          />
        </Section>

        <Section id="webhooks" title="Webhooks">
          <P>
            Register endpoints under <strong>Developer → Webhooks</strong> (or via{" "}
            <Code>POST /api/public/v1/webhooks</Code>). Supported events:{" "}
            <Code>file.created</Code>, <Code>file.updated</Code>, <Code>file.deleted</Code>,{" "}
            <Code>transfer.completed</Code>, <Code>transfer.failed</Code>,{" "}
            <Code>drive.connected</Code>, <Code>share.accessed</Code>.
          </P>
          <P>
            Every delivery is POSTed JSON with headers <Code>X-ODrive-Event</Code>,{" "}
            <Code>X-ODrive-Timestamp</Code> and <Code>X-ODrive-Signature</Code>. Verify the
            signature before processing — it is HMAC-SHA256 of <Code>timestamp.body</Code> with
            your endpoint's signing secret:
          </P>
          <CodeBlock
            label="Node / edge runtime"
            code={`import { createHmac, timingSafeEqual } from "crypto";

const expected = createHmac("sha256", WEBHOOK_SECRET)
  .update(\`\${timestamp}.\${rawBody}\`)
  .digest("hex");

if (!timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
  return new Response("invalid signature", { status: 401 });
}`}
          />
          <P>
            Failed deliveries retry with backoff (1m, 5m, 15m, 1h, 6h, 24h). Inspect attempts and
            replay deliveries from the Webhooks tab.
          </P>
        </Section>

        <Section id="errors" title="Error handling">
          <P>
            Errors always use the same envelope, and the HTTP status matches the failure category:
          </P>
          <CodeBlock
            code={`{
  "error": {
    "code": "file_not_found",
    "message": "No file with id fil_123 in this workspace",
    "request_id": "req_01J…"
  }
}`}
          />
          <ul className="list-inside list-disc space-y-1 text-sm text-muted-foreground">
            <li>
              <Code>401 unauthorized</Code> — missing, revoked or expired API key
            </li>
            <li>
              <Code>403 forbidden</Code> — key lacks the required scope
            </li>
            <li>
              <Code>404 not_found</Code> — resource missing or outside your workspace
            </li>
            <li>
              <Code>422 validation_error</Code> — malformed body or query parameters
            </li>
            <li>
              <Code>429 rate_limited</Code> — too many requests; back off and retry
            </li>
            <li>
              <Code>502 provider_error</Code> — the upstream storage provider failed
            </li>
          </ul>
        </Section>

        <Section id="self-host" title="Local & self-hosted deployment">
          <P>
            ODrive is a TanStack Start (React 19 + Vite) app with server functions. It needs Bun
            (or Node 20+) and a PostgreSQL database reached over HTTP — the bundled adapter talks
            to a Supabase-compatible PostgREST endpoint, so no TCP database driver is required.
          </P>
          <CodeBlock
            label="Run locally"
            code={`git clone <your-fork> odrive && cd odrive
bun install
cp .env.example .env        # fill in the variables below
bun run dev                 # http://localhost:8080`}
          />
          <CodeBlock
            label="Build & serve on your own server"
            code={`bun run build               # outputs the production server bundle
bun run start               # or serve .output/ with your process manager`}
          />
          <P>
            Any host that runs Node 20+ works (VM, container, Fly.io, Railway). Set the environment
            variables from the section below and run the database migrations once against your
            Postgres instance before first boot.
          </P>
        </Section>

        <Section id="workers" title="Cloudflare Workers deployment">
          <P>
            The server bundle is edge-compatible by design: the database adapter uses HTTP
            (PostgREST) instead of TCP, and all crypto uses WebCrypto. Deploy with the Cloudflare
            Vite plugin or Wrangler:
          </P>
          <CodeBlock
            code={`bun run build
bunx wrangler deploy        # uses your wrangler.toml / worker entry`}
          />
          <P>Two things to remember on Workers:</P>
          <ul className="list-inside list-disc space-y-1 text-sm text-muted-foreground">
            <li>
              Set every variable from the next section as a Worker secret/var (
              <Code>wrangler secret put SUPABASE_SERVICE_ROLE_KEY</Code>, etc.).
            </li>
            <li>
              Magic-link sign-in redirects to whatever origin the app runs on (
              <Code>window.location.origin/auth</Code>). Add your Workers/custom domain to the auth
              redirect allowlist of your auth backend (e.g.{" "}
              <Code>https://odrive.example.workers.dev/**</Code>), or the confirmation link falls
              back to the configured Site URL.
            </li>
          </ul>
        </Section>

        <Section id="env" title="Required environment variables">
          <div className="overflow-x-auto rounded-md border border-border">
            <table className="w-full text-sm">
              <thead className="bg-surface text-left text-xs text-muted-foreground">
                <tr>
                  <th className="p-3">Variable</th>
                  <th className="p-3">Where</th>
                  <th className="p-3">Purpose</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {[
                  ["VITE_SUPABASE_URL", "client + server", "PostgREST/auth base URL"],
                  ["VITE_SUPABASE_PUBLISHABLE_KEY", "client", "Browser auth & RLS-scoped reads"],
                  ["SUPABASE_URL", "server", "Server-side data access"],
                  ["SUPABASE_PUBLISHABLE_KEY", "server", "Public-scope server reads"],
                  [
                    "SUPABASE_SERVICE_ROLE_KEY",
                    "server (secret)",
                    "Workspace provisioning & writes that bypass RLS",
                  ],
                  [
                    "ODRIVE_ENCRYPTION_KEY",
                    "server (secret)",
                    "PBKDF2 passphrase for encrypting provider credentials",
                  ],
                  ["LOVABLE_API_KEY", "server (managed)", "Email sending & webhooks (Lovable Cloud)"],
                  ["LOVABLE_CRON_SECRET", "server (secret)", "Authenticates scheduled-job callers"],
                ].map(([name, where, purpose]) => (
                  <tr key={name}>
                    <td className="p-3 font-mono text-xs">{name}</td>
                    <td className="p-3 text-xs whitespace-nowrap text-muted-foreground">{where}</td>
                    <td className="p-3 text-xs text-muted-foreground">{purpose}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <P>
            Generate a strong encryption passphrase with <Code>openssl rand -base64 32</Code>.
            Losing it makes stored provider credentials unrecoverable — rotate it only after
            re-saving every credential.
          </P>
        </Section>

        <Section id="database" title="Database / PostgreSQL configuration">
          <P>
            ODrive stores workspaces, drives, file metadata, jobs, shares, automations, API keys
            and audit logs in PostgreSQL. The schema ships as SQL migrations (including row-level
            security policies) — apply them once to any Postgres 14+:
          </P>
          <CodeBlock
            code={`# Apply migrations to your Postgres before first deploy
psql "$DATABASE_URL" -f supabase/migrations/<timestamp>_odrive_schema.sql`}
          />
          <P>
            At runtime the app never opens a TCP connection to Postgres: the adapter in{" "}
            <Code>src/database/postgres.server.ts</Code> calls the PostgREST HTTP API exposed by
            your Supabase project (or any PostgREST-compatible layer). That is what makes the same
            build run on Cloudflare Workers, edge runtimes and classic Node servers unchanged.
          </P>
        </Section>

        <Section id="providers" title="Storage / provider configuration">
          <P>
            End users connect providers from <strong>Files → Connections</strong>; credentials are
            encrypted at rest with <Code>ODRIVE_ENCRYPTION_KEY</Code>.
          </P>
          <ul className="list-inside list-disc space-y-1 text-sm text-muted-foreground">
            <li>
              <strong>Google Drive</strong> — OAuth. Create a Google Cloud OAuth client, enable the
              Drive API, and add <Code>{"{origin}/api/…/oauth/callback"}</Code> as an authorised
              redirect URI.
            </li>
            <li>
              <strong>Amazon S3 / Cloudflare R2</strong> — access key ID, secret, bucket, region
              (R2: endpoint <Code>https://&lt;account&gt;.r2.cloudflarestorage.com</Code>,
              auto region). Supports signed uploads, downloads and streaming.
            </li>
            <li>
              <strong>OneDrive & Telegram</strong> — adapters exist behind a "coming soon" flag;
              enable them once you have app registrations ready.
            </li>
          </ul>
        </Section>

        <Section id="checklist" title="Production checklist">
          <ul className="space-y-1.5 text-sm text-muted-foreground">
            {[
              "All environment variables set as secrets (never committed).",
              "Database migrations applied; RLS enabled on every table.",
              "Auth redirect allowlist contains your production origin (magic links).",
              "ODRIVE_ENCRYPTION_KEY backed up securely.",
              "HTTPS only; cookies and share links assume secure transport.",
              "API keys scoped minimally; rotate on a schedule.",
              "Webhook consumers verify X-ODrive-Signature before processing.",
              "Monitor Developer → Usage for error rate and p95 latency.",
              "Health probes wired: /api/public/health.live and /api/public/health.ready.",
            ].map((item) => (
              <li key={item} className="flex items-start gap-2">
                <Check className="mt-0.5 size-4 shrink-0 text-primary" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </Section>
      </div>
    </div>
  );
}
