/**
 * S3-compatible object operations mapped onto the virtual filesystem.
 * Keys are "photos/2026/shot.png"; virtual paths are "/photos/2026".
 */
import type { FileMetadata } from "@/core/types";
import { guessMimeType, normalizePath } from "@/core/vfs";
import { NotConfiguredError, readBundle } from "./vault.server";
import { resolveS3Config, s3Fetch, s3List, type S3Config } from "./s3.server";

const FOLDER_MARKER = ".odrive-folder";

export async function configFor(connectionId: string, providerId: string): Promise<S3Config> {
  const bundle = await readBundle(connectionId);
  if (!bundle?.["accessKeyId"] || !bundle["secretAccessKey"] || !bundle["bucket"]) {
    throw new NotConfiguredError("Bucket credentials are not configured");
  }
  return resolveS3Config(bundle, providerId);
}

const prefixOf = (path: string) => {
  const normalized = normalizePath(path);
  return normalized === "/" ? "" : `${normalized.slice(1)}/`;
};

export async function s3ListPath(
  connectionId: string,
  providerId: string,
  path: string,
): Promise<FileMetadata[]> {
  const config = await configFor(connectionId, providerId);
  const prefix = prefixOf(path);
  const entries = await s3List(config, prefix);
  return entries
    .filter((entry) => !entry.key.endsWith(FOLDER_MARKER))
    .map((entry) => {
      const relative = entry.key.slice(prefix.length).replace(/\/$/, "");
      return {
        id: `${connectionId}:${entry.key}`,
        connectionId,
        name: relative,
        path: normalizePath(path),
        kind: entry.isPrefix ? ("folder" as const) : ("file" as const),
        mimeType: entry.isPrefix ? "inode/directory" : guessMimeType(relative),
        sizeBytes: entry.size,
        modifiedAt: entry.modifiedAt,
        favorite: false,
        trashed: false,
        providerFileId: entry.key,
      };
    });
}

export async function s3Upload(
  connectionId: string,
  providerId: string,
  path: string,
  file: { name: string; type?: string; bytes: Uint8Array },
): Promise<FileMetadata> {
  const config = await configFor(connectionId, providerId);
  const key = `${prefixOf(path)}${file.name}`;
  const response = await s3Fetch(config, {
    method: "PUT",
    key,
    body: file.bytes,
    contentType: file.type || guessMimeType(file.name),
  });
  if (!response.ok) throw new Error(`Upload failed (${response.status})`);
  return {
    id: `${connectionId}:${key}`,
    connectionId,
    name: file.name,
    path: normalizePath(path),
    kind: "file",
    mimeType: file.type || guessMimeType(file.name),
    sizeBytes: file.bytes.byteLength,
    modifiedAt: new Date().toISOString(),
    favorite: false,
    trashed: false,
    providerFileId: key,
  };
}

export async function s3CreateFolder(
  connectionId: string,
  providerId: string,
  path: string,
  name: string,
): Promise<FileMetadata> {
  const config = await configFor(connectionId, providerId);
  const key = `${prefixOf(path)}${name}/${FOLDER_MARKER}`;
  await s3Fetch(config, { method: "PUT", key, body: new Uint8Array(), contentType: "text/plain" });
  return {
    id: `${connectionId}:${prefixOf(path)}${name}/`,
    connectionId,
    name,
    path: normalizePath(path),
    kind: "folder",
    mimeType: "inode/directory",
    sizeBytes: 0,
    modifiedAt: new Date().toISOString(),
    favorite: false,
    trashed: false,
    providerFileId: `${prefixOf(path)}${name}/`,
  };
}

export async function s3Delete(connectionId: string, providerId: string, key: string): Promise<void> {
  const config = await configFor(connectionId, providerId);
  const response = await s3Fetch(config, { method: "DELETE", key });
  if (!response.ok && response.status !== 404) throw new Error(`Delete failed (${response.status})`);
}

export async function s3Download(
  connectionId: string,
  providerId: string,
  key: string,
): Promise<string> {
  const config = await configFor(connectionId, providerId);
  const response = await s3Fetch(config, { method: "GET", key });
  if (!response.ok) throw new Error(`Download failed (${response.status})`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  return btoa(String.fromCharCode(...bytes));
}

export async function s3CopyKey(
  connectionId: string,
  providerId: string,
  sourceKey: string,
  targetKey: string,
): Promise<void> {
  const config = await configFor(connectionId, providerId);
  const source = await s3Fetch(config, { method: "GET", key: sourceKey });
  if (!source.ok) throw new Error(`Copy source missing (${source.status})`);
  const bytes = new Uint8Array(await source.arrayBuffer());
  const put = await s3Fetch(config, {
    method: "PUT",
    key: targetKey,
    body: bytes,
    contentType: source.headers.get("content-type") ?? "application/octet-stream",
  });
  if (!put.ok) throw new Error(`Copy failed (${put.status})`);
}

export async function s3Quota(connectionId: string, providerId: string) {
  const config = await configFor(connectionId, providerId);
  const entries = await s3List(config, "");
  return {
    usedBytes: entries.reduce((total, entry) => total + entry.size, 0),
    totalBytes: 0,
  };
}

export async function s3Health(connectionId: string, providerId: string): Promise<boolean> {
  const config = await configFor(connectionId, providerId);
  const response = await s3Fetch(config, { method: "GET", query: { "list-type": "2", "max-keys": "1" } });
  return response.ok;
}
