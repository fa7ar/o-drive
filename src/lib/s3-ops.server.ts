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

/** Chunked base64 so multi-megabyte objects never blow the call stack. */
function toBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let index = 0; index < bytes.length; index += chunk) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunk));
  }
  return btoa(binary);
}

export async function s3Download(
  connectionId: string,
  providerId: string,
  key: string,
): Promise<string> {
  const config = await configFor(connectionId, providerId);
  const response = await s3Fetch(config, { method: "GET", key });
  if (!response.ok) throw new Error(`Download failed (${response.status})`);
  return toBase64(new Uint8Array(await response.arrayBuffer()));
}

export interface S3Chunk {
  base64: string;
  offset: number;
  length: number;
  totalBytes: number;
  done: boolean;
  contentType: string;
}

/** Range read used by streaming downloads and previews. */
export async function s3StreamChunk(
  connectionId: string,
  providerId: string,
  key: string,
  offset: number,
  length: number,
): Promise<S3Chunk> {
  const config = await configFor(connectionId, providerId);
  const end = offset + Math.max(1, length) - 1;
  const response = await s3Fetch(config, { method: "GET", key, range: `bytes=${offset}-${end}` });
  if (!response.ok && response.status !== 206) throw new Error(`Stream failed (${response.status})`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  const contentRange = response.headers.get("content-range");
  const totalBytes = contentRange?.includes("/")
    ? Number(contentRange.split("/")[1]) || bytes.byteLength
    : Number(response.headers.get("content-length") ?? bytes.byteLength);
  return {
    base64: toBase64(bytes),
    offset,
    length: bytes.byteLength,
    totalBytes,
    done: offset + bytes.byteLength >= totalBytes,
    contentType: response.headers.get("content-type") ?? "application/octet-stream",
  };
}

/** HEAD-based object metadata; avoids downloading the payload. */
export async function s3Head(
  connectionId: string,
  providerId: string,
  key: string,
): Promise<FileMetadata | null> {
  const config = await configFor(connectionId, providerId);
  const response = await s3Fetch(config, { method: "HEAD", key });
  if (!response.ok) return null;
  const name = key.split("/").pop() ?? key;
  return {
    id: `${connectionId}:${key}`,
    connectionId,
    name,
    path: normalizePath(`/${key.split("/").slice(0, -1).join("/")}`),
    kind: "file",
    mimeType: response.headers.get("content-type") ?? guessMimeType(name),
    sizeBytes: Number(response.headers.get("content-length") ?? 0),
    modifiedAt: response.headers.get("last-modified")
      ? new Date(response.headers.get("last-modified")!).toISOString()
      : new Date().toISOString(),
    favorite: false,
    trashed: false,
    providerFileId: key,
  };
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
