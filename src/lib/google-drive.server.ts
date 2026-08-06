/**
 * Google Drive live implementation. Runs server-side only; access tokens are
 * read from the credential vault and refreshed transparently.
 */
import { oauthConfig } from "@/adapters/oauth";
import type { FileMetadata } from "@/core/types";
import { guessMimeType, joinPath, normalizePath } from "@/core/vfs";
import { NotConfiguredError, patchBundle, readBundle } from "./vault.server";

const API = "https://www.googleapis.com/drive/v3";

interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  modifiedTime?: string;
  parents?: string[];
}

async function accessToken(connectionId: string): Promise<string> {
  const bundle = await readBundle(connectionId);
  if (!bundle?.["accessToken"]) throw new NotConfiguredError("Google Drive is not connected");
  const expiresAt = Number(bundle["expiresAt"] ?? 0);
  if (expiresAt && expiresAt - 60_000 > Date.now()) return bundle["accessToken"];
  if (!bundle["refreshToken"]) return bundle["accessToken"];
  return refreshAccessToken(connectionId, bundle["refreshToken"]);
}

export async function refreshAccessToken(connectionId: string, refreshToken: string): Promise<string> {
  const config = oauthConfig("google-drive")!;
  const clientId = process.env[config.clientIdEnv];
  const clientSecret = process.env[config.clientSecretEnv];
  if (!clientId || !clientSecret) throw new NotConfiguredError("Google OAuth client is not configured");

  const response = await fetch(config.tokenUrl, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  if (!response.ok) throw new Error(`Token refresh failed (${response.status})`);
  const payload = (await response.json()) as { access_token: string; expires_in: number };
  await patchBundle(connectionId, {
    accessToken: payload.access_token,
    expiresAt: String(Date.now() + payload.expires_in * 1000),
  });
  return payload.access_token;
}

async function driveFetch(connectionId: string, path: string, init?: RequestInit): Promise<Response> {
  const token = await accessToken(connectionId);
  const response = await fetch(`${API}${path}`, {
    ...init,
    headers: { ...(init?.headers ?? {}), authorization: `Bearer ${token}` },
  });
  if (!response.ok) throw new Error(`Google Drive error (${response.status})`);
  return response;
}

/** Resolves a virtual path to a Drive folder id, creating nothing. */
async function folderIdForPath(connectionId: string, path: string): Promise<string> {
  let parent = "root";
  for (const segment of normalizePath(path).split("/").filter(Boolean)) {
    const query = encodeURIComponent(
      `'${parent}' in parents and name = '${segment.replace(/'/g, "\\'")}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
    );
    const response = await driveFetch(connectionId, `/files?q=${query}&fields=files(id)&pageSize=1`);
    const { files } = (await response.json()) as { files: DriveFile[] };
    if (!files.length) throw new Error(`Folder "${segment}" not found`);
    parent = files[0]!.id;
  }
  return parent;
}

const toMetadata = (connectionId: string, path: string, file: DriveFile): FileMetadata => ({
  id: `${connectionId}:${file.id}`,
  connectionId,
  name: file.name,
  path: normalizePath(path),
  kind: file.mimeType === "application/vnd.google-apps.folder" ? "folder" : "file",
  mimeType: file.mimeType,
  sizeBytes: Number(file.size ?? 0),
  modifiedAt: file.modifiedTime ?? new Date().toISOString(),
  favorite: false,
  trashed: false,
  providerFileId: file.id,
});

const FIELDS = "files(id,name,mimeType,size,modifiedTime,parents)";

export async function driveList(connectionId: string, path: string): Promise<FileMetadata[]> {
  const parent = await folderIdForPath(connectionId, path);
  const query = encodeURIComponent(`'${parent}' in parents and trashed = false`);
  const response = await driveFetch(connectionId, `/files?q=${query}&fields=${FIELDS}&pageSize=200`);
  const { files } = (await response.json()) as { files: DriveFile[] };
  return files.map((file) => toMetadata(connectionId, path, file));
}

export async function driveSearch(connectionId: string, term: string): Promise<FileMetadata[]> {
  const query = encodeURIComponent(`name contains '${term.replace(/'/g, "\\'")}' and trashed = false`);
  const response = await driveFetch(connectionId, `/files?q=${query}&fields=${FIELDS}&pageSize=50`);
  const { files } = (await response.json()) as { files: DriveFile[] };
  return files.map((file) => toMetadata(connectionId, "/", file));
}

export async function driveCreateFolder(
  connectionId: string,
  path: string,
  name: string,
): Promise<FileMetadata> {
  const parent = await folderIdForPath(connectionId, path);
  const response = await driveFetch(connectionId, `/files?fields=id,name,mimeType,modifiedTime`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      name,
      parents: [parent],
      mimeType: "application/vnd.google-apps.folder",
    }),
  });
  return toMetadata(connectionId, path, (await response.json()) as DriveFile);
}

export async function driveUpload(
  connectionId: string,
  path: string,
  file: { name: string; type?: string; bytes: Uint8Array },
): Promise<FileMetadata> {
  const parent = await folderIdForPath(connectionId, path);
  const token = await accessToken(connectionId);
  const boundary = `odrive${crypto.randomUUID()}`;
  const metadata = JSON.stringify({ name: file.name, parents: [parent] });
  const mime = file.type || guessMimeType(file.name);
  const head = `--${boundary}\r\ncontent-type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n--${boundary}\r\ncontent-type: ${mime}\r\n\r\n`;
  const tail = `\r\n--${boundary}--\r\n`;
  const body = new Blob([head, file.bytes as BlobPart, tail]);

  const response = await fetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType,size,modifiedTime",
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": `multipart/related; boundary=${boundary}`,
      },
      body,
    },
  );
  if (!response.ok) throw new Error(`Google Drive upload failed (${response.status})`);
  return toMetadata(connectionId, path, (await response.json()) as DriveFile);
}

export async function driveDelete(connectionId: string, fileId: string): Promise<void> {
  await driveFetch(connectionId, `/files/${fileId}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ trashed: true }),
  });
}

export async function driveRename(connectionId: string, fileId: string, name: string): Promise<void> {
  await driveFetch(connectionId, `/files/${fileId}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name }),
  });
}

export async function driveMove(connectionId: string, fileId: string, targetPath: string): Promise<void> {
  const parent = await folderIdForPath(connectionId, targetPath);
  const current = await driveFetch(connectionId, `/files/${fileId}?fields=parents`);
  const { parents } = (await current.json()) as { parents?: string[] };
  await driveFetch(
    connectionId,
    `/files/${fileId}?addParents=${parent}&removeParents=${(parents ?? []).join(",")}`,
    { method: "PATCH" },
  );
}

export async function driveCopy(
  connectionId: string,
  fileId: string,
  targetPath: string,
): Promise<FileMetadata> {
  const parent = await folderIdForPath(connectionId, targetPath);
  const response = await driveFetch(
    connectionId,
    `/files/${fileId}/copy?fields=id,name,mimeType,size,modifiedTime`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ parents: [parent] }),
    },
  );
  return toMetadata(connectionId, targetPath, (await response.json()) as DriveFile);
}

export async function driveDownloadUrlBytes(connectionId: string, fileId: string): Promise<string> {
  const response = await driveFetch(connectionId, `/files/${fileId}?alt=media`);
  const buffer = new Uint8Array(await response.arrayBuffer());
  return btoa(String.fromCharCode(...buffer));
}

export async function driveMetadata(connectionId: string, fileId: string): Promise<FileMetadata> {
  const response = await driveFetch(
    connectionId,
    `/files/${fileId}?fields=id,name,mimeType,size,modifiedTime,parents`,
  );
  return toMetadata(connectionId, "/", (await response.json()) as DriveFile);
}

export async function driveQuota(connectionId: string) {
  const token = await accessToken(connectionId);
  const response = await fetch(`${API}/about?fields=storageQuota,user`, {
    headers: { authorization: `Bearer ${token}` },
  });
  if (!response.ok) throw new Error(`Google Drive quota failed (${response.status})`);
  const payload = (await response.json()) as {
    storageQuota: { usage?: string; limit?: string };
    user: { emailAddress?: string; displayName?: string };
  };
  return {
    usedBytes: Number(payload.storageQuota.usage ?? 0),
    totalBytes: Number(payload.storageQuota.limit ?? 0),
    email: payload.user.emailAddress ?? "",
    displayName: payload.user.displayName ?? "",
  };
}

export const driveJoin = joinPath;
