import { ODriveError } from "@/core/errors";

/**
 * Input hardening shared by UI and server paths: path traversal, MIME/size
 * limits and an SSRF allowlist for user-configurable URLs.
 */

const CONTROL_CHARS = /[\u0000-\u001f\u007f]/;

/** Normalises a virtual path and rejects traversal, control chars, UNC paths. */
export function safePath(input: string): string {
  const raw = (input ?? "").trim();
  if (CONTROL_CHARS.test(raw)) throw new ODriveError("PATH_INVALID");
  const decoded = (() => {
    try {
      return decodeURIComponent(raw);
    } catch {
      return raw;
    }
  })();
  if (decoded.includes("..") || decoded.startsWith("\\\\") || /^[a-zA-Z]:[\\/]/.test(decoded)) {
    throw new ODriveError("PATH_INVALID");
  }
  const segments = decoded
    .replace(/\\/g, "/")
    .split("/")
    .map((segment) => segment.trim())
    .filter((segment) => segment && segment !== ".");
  return `/${segments.join("/")}`;
}

/** Rejects file names that could escape a folder or shadow system entries. */
export function safeFileName(name: string): string {
  const raw = (name ?? "").trim();
  if (!raw || raw === "." || raw === "..") throw new ODriveError("VALIDATION_FAILED");
  if (CONTROL_CHARS.test(raw) || /[\\/]/.test(raw)) throw new ODriveError("VALIDATION_FAILED");
  if (raw.length > 255) throw new ODriveError("VALIDATION_FAILED");
  return raw;
}

const BLOCKED_MIME = [/^application\/x-msdownload$/i, /^application\/x-sh$/i, /^text\/x-php$/i];

export function assertUploadAllowed(file: { name: string; size: number; type?: string }, maxUploadMb: number): void {
  safeFileName(file.name);
  const maxBytes = Math.max(1, maxUploadMb) * 1024 * 1024;
  if (file.size > maxBytes) {
    throw new ODriveError("FILE_TOO_LARGE", {
      message: `That file is larger than the ${maxUploadMb} MB upload limit.`,
    });
  }
  if (file.type && BLOCKED_MIME.some((pattern) => pattern.test(file.type!))) {
    throw new ODriveError("UNSUPPORTED_MEDIA_TYPE");
  }
}

/** Hosts an operator may point webhooks / S3 endpoints at. */
const ALLOWED_URL_SUFFIXES = [
  ".r2.cloudflarestorage.com",
  ".amazonaws.com",
  ".backblazeb2.com",
  ".digitaloceanspaces.com",
  ".hooks.slack.com",
  "hooks.slack.com",
  ".webhook.site",
];

const PRIVATE_HOST = /^(localhost|127\.|10\.|192\.168\.|169\.254\.|0\.0\.0\.0|\[?::1\]?|172\.(1[6-9]|2\d|3[01])\.)/i;

/** SSRF guard: https only, public host, allowlisted suffix. */
export function assertUrlAllowed(input: string): URL {
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    throw new ODriveError("URL_NOT_ALLOWED", { message: "Enter a full https:// URL." });
  }
  if (url.protocol !== "https:") {
    throw new ODriveError("URL_NOT_ALLOWED", { message: "Only https:// URLs are allowed." });
  }
  if (PRIVATE_HOST.test(url.hostname)) {
    throw new ODriveError("URL_NOT_ALLOWED", { message: "Internal addresses are not allowed." });
  }
  const allowed = ALLOWED_URL_SUFFIXES.some(
    (suffix) => url.hostname === suffix.replace(/^\./, "") || url.hostname.endsWith(suffix),
  );
  if (!allowed) {
    throw new ODriveError("URL_NOT_ALLOWED", {
      message: "That host isn't on the allowlist. Contact an admin to add it.",
    });
  }
  return url;
}

export const isEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(value.trim());
