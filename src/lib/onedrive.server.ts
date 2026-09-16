/**
 * OneDrive beta live implementation backed by Microsoft Graph.
 * Tokens are server-side only and loaded from the encrypted provider vault.
 */
import type { FileMetadata } from "@/core/types";
import { guessMimeType, joinPath, normalizePath } from "@/core/vfs";
import { NotConfiguredError, readBundle } from "./vault.server";

const API = "https://graph.microsoft.com/v1.0";

interface GraphItem {
  id: string;
  name: string;
  size?: number;
  createdDateTime?: string;
  lastModifiedDateTime?: string;
  parentReference?: { path?: string };
  folder?: { childCount?: number };
  file?: { mimeType?: string };
}

async function tokenFor(connectionId: string): Promise<string> {
  const bundle = await readBundle(connectionId);
  if (!bundle?.["accessToken"]) throw new NotConfiguredError("OneDrive is not connected");
  return bundle["accessToken"];
}

async function graphFetch(connectionId: string, path: string, init?: RequestInit): Promise<Response> {
  const token = await tokenFor(connectionId);
  const response = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      ...(init?.headers ?? {}),
      authorization: `Bearer ${token}`,
    },
  });
  if (!response.ok) throw new Error(`OneDrive error (${response.status})`);
  return response;
}

const encodePath = (path: string) =>
  normalizePath(path)
    .split("/")
    .filter(Boolean)
    .map(encodeURIComponent)
    .join("/");

const childrenPath = (path: string) => {
  const encoded = encodePath(path);
  return encoded ? `/me/drive/root:/${encoded}:/children` : "/me/drive/root/children";
};

const uploadPath = (path: string, name: string) => {
  const encodedFolder = encodePath(path);
  const encodedName = encodeURIComponent(name);
  return encodedFolder
    ? `/me/drive/root:/${encodedFolder}/${encodedName}:/content`
    : `/me/drive/root:/${encodedName}:/content`;
};

const parentFromGraph = (fallback: string, item: GraphItem) => {
  const providerPath = item.parentReference?.path ?? "";
  const marker = "/drive/root:";
  const index = providerPath.indexOf(marker);
  if (index === -1) return normalizePath(fallback);
  return normalizePath(providerPath.slice(index + marker.length) || "/");
};

const toMetadata = (connectionId: string, fallbackPath: string, item: GraphItem): FileMetadata => ({
  id: `${connectionId}:${item.id}`,
  connectionId,
  name: item.name,
  path: parentFromGraph(fallbackPath, item),
  kind: item.folder ? "folder" : "file",
  mimeType: item.folder ? "inode/directory" : item.file?.mimeType || guessMimeType(item.name),
  sizeBytes: item.size ?? 0,
  modifiedAt: item.lastModifiedDateTime ?? new Date().toISOString(),
  createdAt: item.createdDateTime,
  favorite: false,
  trashed: false,
  providerFileId: item.id,
});

async function arrayBufferToBase64(buffer: ArrayBuffer): Promise<string> {
  let binary = "";
  const bytes = new Uint8Array(buffer);
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.slice(offset, offset + 0x8000));
  }
  return btoa(binary);
}

export async function oneDriveList(connectionId: string, path: string): Promise<FileMetadata[]> {
  const response = await graphFetch(connectionId, childrenPath(path));
  const payload = (await response.json()) as { value: GraphItem[] };
  return payload.value.map((item) => toMetadata(connectionId, path, item));
}

export async function oneDriveSearch(connectionId: string, query: string): Promise<FileMetadata[]> {
  const response = await graphFetch(connectionId, `/me/drive/root/search(q='${encodeURIComponent(query)}')`);
  const payload = (await response.json()) as { value: GraphItem[] };
  return payload.value.map((item) => toMetadata(connectionId, "/", item));
}

export async function oneDriveCreateFolder(connectionId: string, path: string, name: string): Promise<FileMetadata> {
  const response = await graphFetch(connectionId, childrenPath(path), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      name,
      folder: {},
      "@microsoft.graph.conflictBehavior": "rename",
    }),
  });
  return toMetadata(connectionId, path, (await response.json()) as GraphItem);
}

export async function oneDriveUpload(
  connectionId: string,
  path: string,
  file: { name: string; type?: string; bytes: Uint8Array },
): Promise<FileMetadata> {
  const response = await graphFetch(connectionId, uploadPath(path, file.name), {
    method: "PUT",
    headers: { "content-type": file.type || guessMimeType(file.name) },
    body: file.bytes,
  });
  return toMetadata(connectionId, path, (await response.json()) as GraphItem);
}

export async function oneDriveDownload(connectionId: string, fileId: string): Promise<string> {
  const response = await graphFetch(connectionId, `/me/drive/items/${encodeURIComponent(fileId)}/content`);
  return arrayBufferToBase64(await response.arrayBuffer());
}

export async function oneDriveDelete(connectionId: string, fileId: string): Promise<void> {
  await graphFetch(connectionId, `/me/drive/items/${encodeURIComponent(fileId)}`, { method: "DELETE" });
}

export async function oneDriveRename(connectionId: string, fileId: string, name: string): Promise<FileMetadata> {
  const response = await graphFetch(connectionId, `/me/drive/items/${encodeURIComponent(fileId)}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name }),
  });
  return toMetadata(connectionId, "/", (await response.json()) as GraphItem);
}

export async function oneDriveMetadata(connectionId: string, fileId: string): Promise<FileMetadata> {
  const response = await graphFetch(connectionId, `/me/drive/items/${encodeURIComponent(fileId)}`);
  return toMetadata(connectionId, "/", (await response.json()) as GraphItem);
}

export async function oneDriveQuota(connectionId: string): Promise<{ usedBytes: number; totalBytes: number }> {
  const response = await graphFetch(connectionId, "/me/drive");
  const drive = (await response.json()) as { quota?: { used?: number; total?: number } };
  return { usedBytes: drive.quota?.used ?? 0, totalBytes: drive.quota?.total ?? 0 };
}

export async function oneDriveUser(connectionId: string): Promise<{ id: string; label: string; email?: string }> {
  const response = await graphFetch(connectionId, "/me");
  const user = (await response.json()) as { id?: string; displayName?: string; mail?: string; userPrincipalName?: string };
  return {
    id: user.id ?? connectionId,
    label: user.displayName || user.mail || user.userPrincipalName || "OneDrive account",
    email: user.mail || user.userPrincipalName,
  };
}

export async function oneDriveHealth(connectionId: string): Promise<boolean> {
  await graphFetch(connectionId, "/me/drive?$select=id");
  return true;
}

export async function oneDriveMove(connectionId: string, fileId: string, path: string): Promise<FileMetadata> {
  const folder = await oneDriveCreateFolder(connectionId, path, ".odrive-target-check");
  await oneDriveDelete(connectionId, folder.providerFileId ?? folder.id.split(":").pop() ?? folder.id);
  const response = await graphFetch(connectionId, `/me/drive/items/${encodeURIComponent(fileId)}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ parentReference: { path: `/drive/root:${normalizePath(path)}` } }),
  });
  return toMetadata(connectionId, path, (await response.json()) as GraphItem);
}

export async function oneDriveCopy(connectionId: string, fileId: string, path: string): Promise<{ ok: true }> {
  await graphFetch(connectionId, `/me/drive/items/${encodeURIComponent(fileId)}/copy`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ parentReference: { path: `/drive/root:${normalizePath(path)}` } }),
  });
  return { ok: true };
}
