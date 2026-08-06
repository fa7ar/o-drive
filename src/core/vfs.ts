import type { FileMetadata } from "./types";

/**
 * Virtual filesystem helpers. The UI only ever speaks in user-facing paths
 * ("/photos/2026"); adapters translate those into vendor-native IDs.
 */

export function normalizePath(path: string): string {
  if (!path || path === "/") return "/";
  const cleaned = path.replace(/\\+/g, "/").replace(/\/+/g, "/").replace(/\/$/, "");
  return cleaned.startsWith("/") ? cleaned : `/${cleaned}`;
}

export function joinPath(path: string, name: string): string {
  return normalizePath(`${normalizePath(path)}/${name}`);
}

export function parentPath(path: string): string {
  const normalized = normalizePath(path);
  if (normalized === "/") return "/";
  return normalizePath(normalized.slice(0, normalized.lastIndexOf("/")) || "/");
}

export function segments(path: string): string[] {
  return normalizePath(path).split("/").filter(Boolean);
}

export function breadcrumbs(path: string): Array<{ label: string; path: string }> {
  const crumbs = [{ label: "All files", path: "/" }];
  let current = "";
  for (const segment of segments(path)) {
    current = `${current}/${segment}`;
    crumbs.push({ label: segment, path: current });
  }
  return crumbs;
}

/** Folder path a folder record represents (its own virtual directory). */
export function folderPath(file: FileMetadata): string {
  return joinPath(file.path, file.name);
}

/** True when `child` lives inside `ancestor` (at any depth). */
export function isDescendant(child: string, ancestor: string): boolean {
  const a = normalizePath(ancestor);
  const c = normalizePath(child);
  if (a === "/") return c !== "/";
  return c === a || c.startsWith(`${a}/`);
}

export function extensionOf(name: string): string {
  const index = name.lastIndexOf(".");
  return index > 0 ? name.slice(index + 1).toLowerCase() : "";
}

const MIME_BY_EXT: Record<string, string> = {
  pdf: "application/pdf",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  mp4: "video/mp4",
  mp3: "audio/mpeg",
  zip: "application/zip",
  md: "text/markdown",
  txt: "text/plain",
  csv: "text/csv",
  json: "application/json",
};

export function guessMimeType(name: string, fallback = "application/octet-stream"): string {
  return MIME_BY_EXT[extensionOf(name)] ?? fallback;
}
