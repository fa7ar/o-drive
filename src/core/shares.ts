import { useContainer } from "./container";
import { hashIp, hashPassword, randomToken, verifyPassword } from "./crypto";
import { publish } from "./event-bus";
import { log } from "./logs";
import { tryGetProvider } from "./registry";
import { listAllFiles } from "./services";
import { StorageManager } from "./storage-manager";
import type {
  PublicShareResource,
  Share,
  ShareAccessAction,
  ShareAccessLog,
  ShareErrorCode,
  ShareSecurityPolicy,
  ShareType,
  ShareView,
} from "./types";
import { CURRENT_WORKSPACE } from "@/core/workspace";

/**
 * Share service — the provider-agnostic sharing core.
 *
 * Nothing here knows about Google Drive, S3, R2 or Telegram: resolution always
 * goes Drive → Connection → adapter, and every public response is normalised so
 * provider ids, credentials and native paths never leave the server boundary.
 */

export class ShareError extends Error {
  constructor(readonly code: ShareErrorCode) {
    super(code);
    this.name = "ShareError";
  }
}

export const SHARE_ERROR_MESSAGES: Record<ShareErrorCode, string> = {
  SHARE_NOT_FOUND: "This link does not exist.",
  SHARE_EXPIRED: "This link has expired.",
  SHARE_REVOKED: "This link has been revoked by its owner.",
  PASSWORD_REQUIRED: "This link is password protected.",
  INVALID_PASSWORD: "That password is not correct.",
  DOWNLOAD_LIMIT_REACHED: "This link reached its download limit.",
  RESOURCE_NOT_FOUND: "The shared item is no longer available.",
  PROVIDER_UNAVAILABLE: "The storage backing this link is unavailable.",
  DOWNLOAD_NOT_SUPPORTED: "Downloads are not enabled for this link.",
  RATE_LIMITED: "Too many attempts. Try again in a minute.",
};

/** Demo default policy; the admin console edits it in place. */
let policy: ShareSecurityPolicy = {
  defaultExpiryHours: 168,
  requirePasswordForPublic: false,
  minPasswordLength: 8,
  maxPasswordAttempts: 5,
  accessRatePerMinute: 60,
  maxDownloadsDefault: null,
};

export function sharePolicy(): ShareSecurityPolicy {
  return { ...policy };
}

export function updateSharePolicy(patch: Partial<ShareSecurityPolicy>): ShareSecurityPolicy {
  policy = { ...policy, ...patch };
  return sharePolicy();
}

/* ------------------------------ rate limiting ------------------------------ */

const buckets = new Map<string, number[]>();

function rateLimit(key: string, limit: number, windowMs = 60_000): void {
  const now = Date.now();
  const hits = (buckets.get(key) ?? []).filter((at) => now - at < windowMs);
  if (hits.length >= limit) throw new ShareError("RATE_LIMITED");
  hits.push(now);
  buckets.set(key, hits);
}

/* -------------------------------- management ------------------------------- */

export async function listShares(): Promise<ShareView[]> {
  const { shares, drives, connections, shareLogs } = useContainer();
  const [all, driveList, accounts] = await Promise.all([
    shares.list(CURRENT_WORKSPACE),
    drives.list(CURRENT_WORKSPACE),
    connections.list(CURRENT_WORKSPACE),
  ]);
  return Promise.all(
    all.map(async (share) => {
      const drive = driveList.find((entry) => entry.id === share.driveId);
      const connection = accounts.find((entry) => entry.id === drive?.connectionId);
      return {
        share: settleStatus(share),
        driveName: drive?.name ?? "Removed drive",
        providerId: connection?.providerId ?? null,
        accessCount: await shareLogs.countForShare(share.id),
      };
    }),
  );
}

export async function listAllShares(): Promise<ShareView[]> {
  return listShares();
}

export async function listShareAccessLogs(filter: {
  shareId?: string;
  limit?: number;
} = {}): Promise<ShareAccessLog[]> {
  return useContainer().shareLogs.list(filter);
}

export interface CreateShareInput {
  driveId: string;
  resourceId: string;
  resourceType: Share["resourceType"];
  resourceName: string;
  shareType: ShareType;
  password?: string;
  expiresInHours?: number | null;
  allowDownload: boolean;
  allowPreview: boolean;
  maxDownloads?: number | null;
}

export async function createShare(input: CreateShareInput): Promise<Share> {
  const { shares } = useContainer();
  const needsPassword =
    input.shareType === "password_protected" ||
    (input.shareType === "public" && policy.requirePasswordForPublic);
  if (needsPassword) {
    if (!input.password || input.password.length < policy.minPasswordLength) {
      throw new Error(`Password must be at least ${policy.minPasswordLength} characters`);
    }
  }
  const hours = input.expiresInHours === null ? null : (input.expiresInHours ?? policy.defaultExpiryHours);
  const created = await shares.create({
    workspaceId: CURRENT_WORKSPACE,
    driveId: input.driveId,
    resourceType: input.resourceType,
    resourceId: input.resourceId,
    resourceName: input.resourceName,
    token: randomToken(),
    createdBy: "you",
    shareType: input.shareType,
    status: "active",
    expiresAt: hours ? new Date(Date.now() + hours * 3_600_000).toISOString() : null,
    passwordHash: input.password ? await hashPassword(input.password) : null,
    allowDownload: input.allowDownload,
    allowPreview: input.allowPreview,
    maxDownloads: input.maxDownloads ?? policy.maxDownloadsDefault ?? null,
    downloadCount: 0,
  });
  await log({
    category: "share",
    severity: "info",
    message: `Share created for "${created.resourceName}" (${created.shareType})`,
    context: { shareId: created.id },
  });
  publish({ type: "log.appended", category: "share" });
  return created;
}

export async function updateShare(
  shareId: string,
  patch: {
    shareType?: ShareType;
    password?: string | null;
    expiresInHours?: number | null;
    allowDownload?: boolean;
    allowPreview?: boolean;
    maxDownloads?: number | null;
  },
): Promise<Share> {
  const { shares } = useContainer();
  const next: Partial<Share> = {};
  if (patch.shareType) next.shareType = patch.shareType;
  if (patch.allowDownload !== undefined) next.allowDownload = patch.allowDownload;
  if (patch.allowPreview !== undefined) next.allowPreview = patch.allowPreview;
  if (patch.maxDownloads !== undefined) next.maxDownloads = patch.maxDownloads;
  if (patch.expiresInHours !== undefined) {
    next.expiresAt = patch.expiresInHours
      ? new Date(Date.now() + patch.expiresInHours * 3_600_000).toISOString()
      : null;
    next.status = "active";
  }
  if (patch.password !== undefined) {
    if (patch.password === null || patch.password === "") next.passwordHash = null;
    else {
      if (patch.password.length < policy.minPasswordLength) {
        throw new Error(`Password must be at least ${policy.minPasswordLength} characters`);
      }
      next.passwordHash = await hashPassword(patch.password);
    }
  }
  const updated = await shares.update(shareId, next);
  await log({
    category: "share",
    severity: "info",
    message: `Share for "${updated.resourceName}" updated`,
    context: { shareId },
  });
  return updated;
}

export async function revokeShare(shareId: string): Promise<Share> {
  const updated = await useContainer().shares.update(shareId, { status: "revoked" });
  await log({
    category: "share",
    severity: "warning",
    message: `Share for "${updated.resourceName}" revoked`,
    context: { shareId },
  });
  return updated;
}

export async function reactivateShare(shareId: string): Promise<Share> {
  return useContainer().shares.update(shareId, {
    status: "active",
    expiresAt: new Date(Date.now() + policy.defaultExpiryHours * 3_600_000).toISOString(),
  });
}

/** Invalidates the public URL instantly and issues a fresh opaque token. */
export async function rotateShareToken(shareId: string): Promise<Share> {
  const updated = await useContainer().shares.update(shareId, {
    token: randomToken(),
    status: "active",
  });
  await log({
    category: "security",
    severity: "warning",
    message: `Share token rotated for "${updated.resourceName}"`,
    context: { shareId },
  });
  return updated;
}

export async function deleteShare(shareId: string): Promise<void> {
  const { shares } = useContainer();
  const share = await shares.get(shareId);
  await shares.remove(shareId);
  if (share) {
    await log({
      category: "share",
      severity: "warning",
      message: `Share for "${share.resourceName}" deleted`,
    });
  }
}

export function shareUrl(token: string): string {
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  return `${origin}/s/${token}`;
}

/* ------------------------------ validation chain --------------------------- */

function settleStatus(share: Share): Share {
  if (share.status === "revoked") return share;
  if (share.expiresAt && Date.parse(share.expiresAt) < Date.now()) {
    return { ...share, status: "expired" };
  }
  if (share.maxDownloads !== null && share.downloadCount >= share.maxDownloads) {
    return { ...share, status: "limit_reached" };
  }
  return share;
}

async function resolveShare(token: string): Promise<Share> {
  rateLimit(`token:${token}`, policy.accessRatePerMinute);
  const raw = await useContainer().shares.findByToken(token);
  if (!raw) throw new ShareError("SHARE_NOT_FOUND");
  const share = settleStatus(raw);
  if (share.status !== raw.status) {
    await useContainer().shares.update(share.id, { status: share.status });
  }
  if (share.status === "revoked") throw new ShareError("SHARE_REVOKED");
  if (share.status === "expired") throw new ShareError("SHARE_EXPIRED");
  if (share.status === "limit_reached") throw new ShareError("DOWNLOAD_LIMIT_REACHED");
  return share;
}

async function recordAccess(
  share: Share,
  action: ShareAccessAction,
  status: "success" | "failed",
): Promise<void> {
  const { shareLogs } = useContainer();
  const agent = typeof navigator === "undefined" ? "server" : navigator.userAgent;
  await shareLogs.record({
    shareId: share.id,
    resourceId: share.resourceId,
    action,
    status,
    userId: null,
    ipHash: await hashIp(agent),
    userAgent: agent,
  });
}

/** Public gateway step 1: token validation only — no resource work. */
export async function validateShareToken(token: string): Promise<{
  token: string;
  requiresPassword: boolean;
  resourceType: Share["resourceType"];
  name: string;
}> {
  const share = await resolveShare(token);
  return {
    token: share.token,
    requiresPassword: share.shareType === "password_protected",
    resourceType: share.resourceType,
    name: share.resourceName,
  };
}

/** Public gateway step 2: password check for protected shares. */
export async function authenticateShare(token: string, password: string): Promise<boolean> {
  const share = await resolveShare(token);
  rateLimit(`pw:${token}`, policy.maxPasswordAttempts);
  if (share.shareType !== "password_protected") return true;
  // Demo shares seed without a hash; the documented demo password is used once
  // and then persisted as a hash so behaviour matches production from then on.
  const stored = share.passwordHash ?? (await hashPassword("odrive-demo"));
  if (!share.passwordHash) await useContainer().shares.update(share.id, { passwordHash: stored });
  const ok = await verifyPassword(password, stored);
  await recordAccess(share, ok ? "view" : "password_failed", ok ? "success" : "failed");
  if (!ok) throw new ShareError("INVALID_PASSWORD");
  return true;
}

/**
 * Public gateway step 3: normalised resource metadata. Folder shares expose
 * their contents relative to the shared root and never above it.
 */
export async function getShareResource(
  token: string,
  password?: string,
): Promise<PublicShareResource> {
  const share = await resolveShare(token);
  if (share.shareType === "password_protected") {
    if (!password) throw new ShareError("PASSWORD_REQUIRED");
    await authenticateShare(token, password);
  }

  const { drives, connections } = useContainer();
  const drive = await drives.get(share.driveId);
  if (!drive) throw new ShareError("RESOURCE_NOT_FOUND");
  const connection = await connections.get(drive.connectionId);
  if (!connection || connection.status === "error") throw new ShareError("PROVIDER_UNAVAILABLE");

  const indexed = await listAllFiles([connection.id]);
  const resource = indexed.find((file) => file.id === share.resourceId);
  const name = resource?.name ?? share.resourceName;
  const root = resource ? `${resource.path === "/" ? "" : resource.path}/${resource.name}` : "/";

  const children =
    share.resourceType === "folder"
      ? indexed
          .filter((file) => file.path === root && !file.trashed)
          .map((file) => ({
            id: file.id,
            name: file.name,
            kind: file.kind === "folder" ? ("folder" as const) : ("file" as const),
            sizeBytes: file.sizeBytes,
            mimeType: file.mimeType,
            modifiedAt: file.modifiedAt,
          }))
      : undefined;

  await recordAccess(share, "view", "success");

  return {
    token: share.token,
    resourceType: share.resourceType,
    name,
    sizeBytes: resource?.sizeBytes ?? 0,
    mimeType: resource?.mimeType ?? "application/octet-stream",
    modifiedAt: resource?.modifiedAt ?? share.updatedAt,
    allowDownload: share.allowDownload,
    allowPreview: share.allowPreview,
    expiresAt: share.expiresAt,
    downloadsRemaining:
      share.maxDownloads === null ? null : Math.max(0, share.maxDownloads - share.downloadCount),
    requiresPassword: share.shareType === "password_protected",
    ...(children ? { children } : {}),
  };
}

export interface ShareDownload {
  strategy: "temporary-url" | "stream" | "buffered";
  url?: string;
  name: string;
  sizeBytes: number;
  mimeType: string;
}

/**
 * Public gateway step 4: download. The strategy is chosen from adapter
 * capabilities — temporary URL first, then streaming, then buffered blob.
 */
export async function downloadShare(
  token: string,
  fileId?: string,
  password?: string,
): Promise<ShareDownload> {
  const share = await resolveShare(token);
  if (!share.allowDownload) throw new ShareError("DOWNLOAD_NOT_SUPPORTED");
  if (share.shareType === "password_protected") {
    if (!password) throw new ShareError("PASSWORD_REQUIRED");
    await authenticateShare(token, password);
  }

  const { drives, connections, shares } = useContainer();
  const drive = await drives.get(share.driveId);
  if (!drive) throw new ShareError("RESOURCE_NOT_FOUND");
  const connection = await connections.get(drive.connectionId);
  if (!connection) throw new ShareError("PROVIDER_UNAVAILABLE");

  const targetId = fileId ?? share.resourceId;
  const indexed = await listAllFiles([connection.id]);
  const resource = indexed.find((file) => file.id === targetId);
  if (share.resourceType === "folder" && fileId) {
    // Folder shares may only serve descendants of the shared root.
    const rootFile = indexed.find((file) => file.id === share.resourceId);
    const root = rootFile ? `${rootFile.path === "/" ? "" : rootFile.path}/${rootFile.name}` : "/";
    if (!resource || !resource.path.startsWith(root)) throw new ShareError("RESOURCE_NOT_FOUND");
  }

  let provider;
  try {
    provider = await StorageManager.forConnection(connection.id);
  } catch {
    throw new ShareError("PROVIDER_UNAVAILABLE");
  }

  let strategy: ShareDownload["strategy"] = "buffered";
  let url: string | undefined;
  try {
    const temporary = await provider.getTemporaryDownloadUrl?.(connection.id, targetId, 900);
    if (temporary) {
      strategy = "temporary-url";
      url = temporary;
    } else if (provider.getDownloadStream) {
      const stream = await provider.getDownloadStream(connection.id, targetId);
      if (stream) strategy = "stream";
    }
  } catch {
    strategy = "buffered";
  }

  const updated = await shares.update(share.id, { downloadCount: share.downloadCount + 1 });
  if (updated.maxDownloads !== null && updated.downloadCount >= updated.maxDownloads) {
    await shares.update(share.id, { status: "limit_reached" });
  }
  await recordAccess(share, "download", "success");
  await log({
    category: "share",
    severity: "info",
    message: `Share download served for "${resource?.name ?? share.resourceName}" via ${strategy}`,
    ...(tryGetProvider(connection.providerId) ? { providerId: connection.providerId } : {}),
  });

  return {
    strategy,
    ...(url ? { url } : {}),
    name: resource?.name ?? share.resourceName,
    sizeBytes: resource?.sizeBytes ?? 0,
    mimeType: resource?.mimeType ?? "application/octet-stream",
  };
}
