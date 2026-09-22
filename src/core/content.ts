export type ContentType = "page" | "blog" | "docs" | "changelog" | "legal";
export type ContentStatus = "draft" | "published";

export interface ContentEntry {
  id: string;
  title: string;
  slug: string;
  type: ContentType;
  excerpt: string;
  markdown: string;
  status: ContentStatus;
  publishedAt: string | null;
  showInHeader: boolean;
  showInFooter: boolean;
  navLabel?: string;
  navOrder: number;
  seoTitle?: string;
  metaDescription?: string;
  canonicalUrl?: string;
  index: boolean;
  follow: boolean;
  ogTitle?: string;
  ogDescription?: string;
  ogImageUrl?: string;
  updatedAt: string;
}

export type ContentInput = Omit<ContentEntry, "id" | "updatedAt"> & { id?: string };
const now = () => new Date().toISOString();

const md = {
  privacy: "## What we store\n\nODrive stores account, workspace, drive configuration, file metadata and operational logs. Provider credentials are encrypted and only used server-side.\n\n## What we never store\n\n- File contents.\n- Plaintext credentials, tokens or passwords.\n- Raw IP addresses in share access logs.\n\n## Third-party providers\n\nODrive acts on your behalf against connected providers using the scopes you granted.\n\n## Retention\n\nOperational logs are retained for 30 days, share access logs for 90 days, and workspace deletion removes associated records.\n\n## Contact\n\nPrivacy requests: privacy@odrive.app.",
  terms: "## The service\n\nODrive provides a unified control plane over storage accounts you own or are authorised to use.\n\n## Your responsibilities\n\n- Only connect accounts you are authorised to access.\n- Keep your sign-in email secure.\n- Comply with connected provider terms and limits.\n\n## Availability\n\nODrive depends on third-party providers. Transfers and automations retry with backoff. Beta providers are excluded from availability commitments.\n\n## Termination\n\nYou may delete your workspace at any time. We may suspend accounts that create abuse or security risk.\n\n## Liability\n\nODrive is provided as is.",
  acceptable: "## Principles\n\nODrive moves data between storage you already own. You are responsible for content passing through your workspace.\n\n## Not permitted\n\n- Connecting accounts you are not authorised to access.\n- Storing or distributing unlawful content, malware or phishing material.\n- Sharing content that infringes someone else rights.\n- Using automations to circumvent provider rate limits.\n\n## Enforcement\n\nWe may disable a share link, pause an automation, or suspend a workspace that creates legal or security risk.\n\n## Reporting\n\nReport abuse to abuse@odrive.app.",
  deletion: "## Delete a single drive\n\nOpen Drives, choose the drive, and disconnect it. Credentials are destroyed immediately.\n\n## Delete a share link\n\nOpen Shares and revoke the link.\n\n## Delete your whole workspace\n\n- Go to Settings and choose delete workspace, or\n- Email deletion@odrive.app from your account address.\n\n## Timelines\n\nCredentials and metadata are deleted immediately. Backups and operational logs age out within 30 days.\n\n## Contact\n\nQuestions: privacy@odrive.app.",
};

const seeds: ContentEntry[] = [
  item("page-about", "page", "about", "About ODrive", "One calm workspace for storage accounts across providers.", "## Why ODrive\n\nODrive brings storage accounts into one workspace without making any provider the center of the architecture.\n\n## What it does\n\n- Connect multiple storage providers.\n- Browse, transfer and share files from one interface.\n- Keep credentials server-side and isolated.\n\n## Direction\n\nThe project stays provider-agnostic, Cloudflare-compatible and easy to extend.", true, false, 10, "About"),
  item("blog-introducing-odrive", "blog", "introducing-odrive", "Introducing ODrive", "A short introduction to the Omni Drive idea.", "## The idea\n\nStorage is fragmented. ODrive makes each provider feel like part of the same workspace.\n\n## Current focus\n\nGoogle Drive, Cloudflare R2 and Amazon S3 are production providers. OneDrive and Telegram are beta.\n\n## What comes next\n\nFull provider validation and public launch readiness.", false, false, 30),
  item("docs-getting-started", "docs", "getting-started", "Getting Started", "Connect your first provider and verify runtime configuration.", "## Connect a provider\n\nStart with Google Drive, Cloudflare R2 or Amazon S3.\n\n## Verify configuration\n\nUse admin health and provider screens to confirm credentials and runtime variables.\n\n## Keep secrets out of Git\n\nUse Cloudflare secrets for private values.", false, false, 20, "Docs"),
  item("changelog-0-4-2", "changelog", "v0-4-2", "ODrive 0.4.2", "Backup and sync policies, storage pools and smart routing.", "## Added\n\n- Backup & Sync Policies with source, destination, mode, schedule, retention, conflict handling, pause/resume and manual run state.\n- Storage Pools as routing abstractions above existing connections instead of new storage providers.\n- Routing strategies for Round Robin, Weighted Round Robin, Priority/Failover, Least Used and Most Available Space.\n- Smart routing checks for provider health, connection status, declared capability and destination availability.\n- `/backup-sync` with Policies, Runs and Storage Pools views.\n- Backup & Sync readiness checks for scheduler, backup engine, sync policy, routing engine, storage pools, round robin persistence, weighted routing, health-aware routing, failover and cross-provider transfer.\n\n## Changed\n\n- Registered backup/sync operations in the Universal Action Registry and routed policy runs through `transfer.create`.\n- Updated the member area Activity navigation to include Backup & Sync next to Transfers and Automations.\n\n## Reliability\n\n- Persisted routing cursor and nonce with the storage pool state so round robin does not rely on Worker memory.\n- Kept routing idempotent by using deterministic ActionService idempotency keys for policy runs.\n- Failures now record run history and mark affected policies as error instead of silently retrying forever.", false, false, 39, "ODrive 0.4.2"),
  item("changelog-0-4-0", "changelog", "v0-4-0", "ODrive 0.4.0", "Provider beta rollout, admin simplification and release hardening.", "## Added\n\n- OneDrive beta live adapter.\n- Telegram beta live adapter.\n- Unified admin navigation.\n\n## Security\n\n- Secret scanning for commits and CI.\n\n## Validation\n\nFull provider E2E validation remains open.", false, false, 40, "Changelog"),
  item("legal-privacy", "legal", "privacy", "Privacy Policy", "How ODrive handles data, credentials and retention.", md.privacy, true, false, 100, "Privacy"),
  item("legal-terms", "legal", "terms", "Terms of Service", "Workspace terms covering responsibilities and availability.", md.terms, true, false, 110, "Terms"),
  item("legal-acceptable-use", "legal", "acceptable-use", "Acceptable Use Policy", "Rules for drives, transfers and public share links.", md.acceptable, true, false, 120, "Acceptable use"),
  item("legal-data-deletion", "legal", "data-deletion", "Data Deletion", "How to disconnect drives and delete workspace data.", md.deletion, true, false, 130, "Data deletion"),
];

function item(id: string, type: ContentType, slug: string, title: string, excerpt: string, markdown: string, showInFooter: boolean, showInHeader: boolean, navOrder: number, navLabel?: string): ContentEntry {
  return { id, type, slug, title, excerpt, markdown, status: "published", publishedAt: "2026-09-16T00:00:00.000Z", showInHeader, showInFooter, navLabel, navOrder, index: true, follow: true, updatedAt: now() };
}

const entries = new Map(seeds.map((entry) => [entry.id, entry]));

export const routeBase = (type: ContentType) => type === "blog" ? "/c/blog" : type === "docs" ? "/c/docs" : type === "changelog" ? "/c/changelogs" : type === "legal" ? "/legal" : "/p";
export const contentUrl = (entry: Pick<ContentEntry, "type" | "slug">) => routeBase(entry.type) + "/" + entry.slug;
export const contentArchiveUrl = (type: Extract<ContentType, "blog" | "docs" | "changelog">) => routeBase(type);

export async function listContent(type?: ContentType): Promise<ContentEntry[]> {
  return Array.from(entries.values()).filter((entry) => !type || entry.type === type).sort((a, b) => a.type.localeCompare(b.type) || a.navOrder - b.navOrder || a.title.localeCompare(b.title));
}
export async function listPublishedContent(type?: ContentType): Promise<ContentEntry[]> {
  return (await listContent(type)).filter((entry) => entry.status === "published");
}
export async function getContent(id: string): Promise<ContentEntry | null> { return entries.get(id) ?? null; }
export async function getPublishedContentByRoute(type: ContentType, slug: string): Promise<ContentEntry | null> {
  return (await listPublishedContent(type)).find((entry) => entry.slug === slug) ?? null;
}
export async function saveContent(input: ContentInput): Promise<ContentEntry> {
  const duplicate = Array.from(entries.values()).find((entry) => entry.id !== input.id && entry.type === input.type && entry.slug === input.slug);
  if (duplicate) throw new Error("Slug already exists for this content type");
  const saved: ContentEntry = { ...input, id: input.id || input.type + "-" + input.slug, updatedAt: now() };
  entries.set(saved.id, saved);
  return saved;
}
export async function listNavigationContent(position: "header" | "footer"): Promise<ContentEntry[]> {
  return (await listPublishedContent()).filter((entry) => position === "header" ? entry.showInHeader : entry.showInFooter).sort((a, b) => a.navOrder - b.navOrder || a.title.localeCompare(b.title));
}
export function contentMeta(entry: ContentEntry) {
  const title = entry.seoTitle || entry.title;
  const description = entry.metaDescription || entry.excerpt || "ODrive content";
  return { title: title + " - ODrive", description, ogTitle: entry.ogTitle || title, ogDescription: entry.ogDescription || description, robots: (entry.index ? "index" : "noindex") + "," + (entry.follow ? "follow" : "nofollow") };
}
