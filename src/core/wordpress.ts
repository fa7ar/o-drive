import { saveCredential, setCredentialStatus } from "@/core/credentials";
import { log } from "@/core/logs";
import { CURRENT_WORKSPACE } from "@/core/workspace";

export type WordPressConnectionMode = "standard" | "advanced";
export type WordPressSiteStatus = "healthy" | "attention" | "disconnected";
export type WordPressCapability =
  | "media.browse"
  | "media.upload"
  | "media.metadata"
  | "media.delete"
  | "media.import_from_odrive"
  | "posts.read"
  | "pages.read"
  | "backup.full_site"
  | "backup.database"
  | "backup.uploads"
  | "restore.request"
  | "media.offload"
  | "events.webhooks";

export interface WordPressSite {
  id: string;
  workspaceId: string;
  siteUrl: string;
  name: string;
  username: string;
  mode: WordPressConnectionMode;
  status: WordPressSiteStatus;
  credentialId: string | null;
  wordpressVersion: string | null;
  identityLabel: string | null;
  capabilities: WordPressCapability[];
  backupDestination: { kind: "connection" | "pool"; id: string } | null;
  lastHealthCheckAt: string | null;
  lastBackupAt: string | null;
  nextBackupAt: string | null;
  lastError?: string;
  createdAt: string;
  updatedAt: string;
}

export interface WordPressConnectionDraft {
  siteUrl: string;
  username: string;
  applicationPassword: string;
  mode?: WordPressConnectionMode;
  backupDestination?: WordPressSite["backupDestination"];
}

export interface WordPressConnectionTest {
  ok: boolean;
  status: WordPressSiteStatus;
  siteUrl: string;
  restUrl: string;
  identityLabel: string | null;
  wordpressVersion: string | null;
  capabilities: WordPressCapability[];
  errors: string[];
  warnings: string[];
}

export interface WordPressSnapshot {
  sites: WordPressSite[];
  standardCapabilities: Array<{ id: WordPressCapability; label: string }>;
  advancedCapabilities: Array<{ id: WordPressCapability; label: string }>;
  connectorContract: typeof WORDPRESS_CONNECTOR_CONTRACT;
}

const sites = new Map<string, WordPressSite>();
const now = () => new Date().toISOString();
const id = (prefix: string) => `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;

export const WORDPRESS_STANDARD_CAPABILITIES: Array<{ id: WordPressCapability; label: string }> = [
  { id: "media.browse", label: "Browse Media Library" },
  { id: "media.upload", label: "Upload media" },
  { id: "media.metadata", label: "Read media metadata" },
  { id: "media.delete", label: "Delete media when permitted" },
  { id: "media.import_from_odrive", label: "Import ODrive files into Media Library" },
  { id: "posts.read", label: "Read basic posts" },
  { id: "pages.read", label: "Read basic pages" },
];

export const WORDPRESS_ADVANCED_CAPABILITIES: Array<{ id: WordPressCapability; label: string }> = [
  { id: "backup.full_site", label: "Full site backup" },
  { id: "backup.database", label: "Database backup" },
  { id: "backup.uploads", label: "Uploads backup" },
  { id: "restore.request", label: "Restore requests" },
  { id: "media.offload", label: "Media offload to ODrive-managed storage" },
  { id: "events.webhooks", label: "Events and webhooks" },
];

export const WORDPRESS_CONNECTOR_CONTRACT = {
  version: "v1",
  basePath: "/api/v1/wordpress",
  authentication: "Bearer ODrive API key with scoped permissions.",
  scopes: [
    "wordpress.site",
    "files.read",
    "files.write",
    "backup.create",
    "backup.read",
    "restore.create",
    "storage.destinations.read",
  ],
  endpoints: [
    { method: "POST", path: "/sites/register", purpose: "Register or reconnect a WordPress site connection." },
    { method: "GET", path: "/sites", purpose: "List WordPress site connections visible to the token." },
    { method: "GET", path: "/sites/:siteId/health", purpose: "Report connector, WordPress and permission health." },
    { method: "POST", path: "/sites/:siteId/backups", purpose: "Create a backup request through Backup & Sync." },
    { method: "GET", path: "/sites/:siteId/backups/:backupId", purpose: "Read backup status." },
    { method: "POST", path: "/sites/:siteId/restores", purpose: "Request restore from an ODrive-managed backup." },
    { method: "GET", path: "/sites/:siteId/restores/:restoreId", purpose: "Read restore status." },
    { method: "POST", path: "/sites/:siteId/media/import", purpose: "Import an ODrive file into WordPress Media Library." },
    { method: "GET", path: "/storage-destinations", purpose: "List drives and storage pools available as destinations." },
    { method: "POST", path: "/events", purpose: "Receive signed connector events and webhooks." },
  ],
} as const;

export async function listWordPress(): Promise<WordPressSnapshot> {
  return {
    sites: [...sites.values()].map(redactSite).sort((a, b) => a.name.localeCompare(b.name)),
    standardCapabilities: WORDPRESS_STANDARD_CAPABILITIES,
    advancedCapabilities: WORDPRESS_ADVANCED_CAPABILITIES,
    connectorContract: WORDPRESS_CONNECTOR_CONTRACT,
  };
}

export async function testWordPressConnection(input: WordPressConnectionDraft): Promise<WordPressConnectionTest> {
  const normalized = normalizeSiteUrl(input.siteUrl);
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!normalized) errors.push("Site URL must be a valid URL.");
  if (normalized && normalized.protocol !== "https:") errors.push("Production WordPress connections require HTTPS.");
  if (!input.username.trim()) errors.push("Username is required.");
  if (input.applicationPassword.trim().length < 8) errors.push("Application Password looks too short.");

  const restUrl = normalized ? new URL("/wp-json/wp/v2", normalized).toString() : "";
  if (normalized && !normalized.hostname.includes(".")) warnings.push("Site hostname does not look public; REST API availability may need manual verification.");

  return {
    ok: errors.length === 0,
    status: errors.length ? "attention" : "healthy",
    siteUrl: normalized?.origin ?? input.siteUrl,
    restUrl,
    identityLabel: errors.length ? null : input.username.trim(),
    wordpressVersion: null,
    capabilities: errors.length ? [] : WORDPRESS_STANDARD_CAPABILITIES.map((capability) => capability.id),
    errors,
    warnings,
  };
}

export async function connectWordPressSite(input: WordPressConnectionDraft): Promise<WordPressSite> {
  const test = await testWordPressConnection(input);
  if (!test.ok) throw new Error(test.errors.join(" "));
  const timestamp = now();
  const credential = await saveCredential({
    providerId: null,
    type: "api-key",
    label: `WordPress Application Password: ${test.siteUrl}`,
    key: `WORDPRESS_APP_PASSWORD_${new URL(test.siteUrl).hostname.replace(/[^a-z0-9]/gi, "_").toUpperCase()}`,
    plaintext: input.applicationPassword,
    rotationDays: 90,
  });
  const site: WordPressSite = {
    id: id("wpsite"),
    workspaceId: CURRENT_WORKSPACE,
    siteUrl: test.siteUrl,
    name: new URL(test.siteUrl).hostname,
    username: input.username.trim(),
    mode: input.mode ?? "standard",
    status: test.status,
    credentialId: credential.id,
    wordpressVersion: test.wordpressVersion,
    identityLabel: test.identityLabel,
    capabilities: test.capabilities,
    backupDestination: input.backupDestination ?? null,
    lastHealthCheckAt: timestamp,
    lastBackupAt: null,
    nextBackupAt: null,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  sites.set(site.id, site);
  await audit("wordpress.site.connected", site.siteUrl);
  return redactSite(site);
}

export async function checkWordPressSite(siteId: string): Promise<WordPressSite> {
  const site = requireSite(siteId);
  const updated: WordPressSite = {
    ...site,
    status: site.credentialId ? "healthy" : "attention",
    lastHealthCheckAt: now(),
    updatedAt: now(),
    lastError: site.credentialId ? undefined : "Application Password credential is missing.",
  };
  sites.set(siteId, updated);
  await audit("wordpress.site.health_checked", updated.siteUrl);
  return redactSite(updated);
}

export async function disconnectWordPressSite(siteId: string): Promise<WordPressSite> {
  const site = requireSite(siteId);
  if (site.credentialId) await setCredentialStatus(site.credentialId, "disabled").catch(() => undefined);
  const updated: WordPressSite = {
    ...site,
    status: "disconnected",
    credentialId: null,
    updatedAt: now(),
  };
  sites.set(siteId, updated);
  await audit("wordpress.site.disconnected", updated.siteUrl, "warning");
  return redactSite(updated);
}

export async function setWordPressBackupDestination(siteId: string, destination: WordPressSite["backupDestination"]): Promise<WordPressSite> {
  const site = requireSite(siteId);
  const updated = { ...site, backupDestination: destination, updatedAt: now() };
  sites.set(siteId, updated);
  await audit("wordpress.site.destination_updated", updated.siteUrl);
  return redactSite(updated);
}

export function redactSite(site: WordPressSite): WordPressSite {
  return { ...site, credentialId: site.credentialId ? "stored" : null };
}

function normalizeSiteUrl(value: string) {
  try {
    const url = new URL(value.trim());
    url.pathname = "/";
    url.search = "";
    url.hash = "";
    return url;
  } catch {
    return null;
  }
}

function requireSite(siteId: string) {
  const site = sites.get(siteId);
  if (!site) throw new Error("WordPress site not found.");
  return site;
}

async function audit(action: string, target: string, severity: "info" | "warning" = "info") {
  await log({ category: "system", severity, message: `${action}: ${target}` }).catch(() => undefined);
}
