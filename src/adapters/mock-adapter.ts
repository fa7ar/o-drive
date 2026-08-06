import type {
  Connection,
  FileMetadata,
  ProviderDescriptor,
  ProviderState,
  ProviderUser,
  Quota,
  StorageProvider,
} from "@/core/types";
import { guessMimeType, joinPath, normalizePath } from "@/core/vfs";

/**
 * Mock adapter factory. It simulates a vendor-side filesystem so the rest of
 * the platform (index, upload engine, VFS) can run end to end without
 * credentials. Live adapters implement the same contract.
 */

const SAMPLE_TREE: Array<Omit<FileMetadata, "id" | "connectionId">> = [
  { name: "photos", path: "/", kind: "folder", mimeType: "inode/directory", sizeBytes: 0, modifiedAt: "2026-07-28T09:12:00Z", favorite: true, trashed: false },
  { name: "documents", path: "/", kind: "folder", mimeType: "inode/directory", sizeBytes: 0, modifiedAt: "2026-07-21T14:02:00Z", favorite: false, trashed: false },
  { name: "quarterly-report.pdf", path: "/", kind: "file", mimeType: "application/pdf", sizeBytes: 2_412_000, modifiedAt: "2026-08-01T11:40:00Z", favorite: true, trashed: false },
  { name: "team-photo.jpg", path: "/photos", kind: "file", mimeType: "image/jpeg", sizeBytes: 5_180_000, modifiedAt: "2026-07-30T18:05:00Z", favorite: false, trashed: false },
  { name: "2026", path: "/photos", kind: "folder", mimeType: "inode/directory", sizeBytes: 0, modifiedAt: "2026-07-30T18:05:00Z", favorite: false, trashed: false },
  { name: "launch-shoot.png", path: "/photos/2026", kind: "file", mimeType: "image/png", sizeBytes: 9_120_000, modifiedAt: "2026-08-02T12:00:00Z", favorite: false, trashed: false },
  { name: "architecture.md", path: "/documents", kind: "file", mimeType: "text/markdown", sizeBytes: 18_400, modifiedAt: "2026-08-02T08:15:00Z", favorite: false, trashed: false },
  { name: "odrive-spec.md", path: "/documents", kind: "file", mimeType: "text/markdown", sizeBytes: 22_900, modifiedAt: "2026-08-03T16:45:00Z", favorite: true, trashed: false },
  { name: "backup-2025.zip", path: "/documents", kind: "file", mimeType: "application/zip", sizeBytes: 184_000_000, modifiedAt: "2026-06-11T10:00:00Z", favorite: false, trashed: false },
  { name: "old-draft.docx", path: "/", kind: "file", mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", sizeBytes: 88_000, modifiedAt: "2026-05-02T10:00:00Z", favorite: false, trashed: true },
];

export function seedFilesFor(connectionId: string): FileMetadata[] {
  return SAMPLE_TREE.map((file, index) => ({
    ...file,
    id: `${connectionId}-f${index}`,
    providerFileId: `mock-${index}`,
    connectionId,
  }));
}

export function createMockAdapter(
  descriptor: ProviderDescriptor,
  hooks: { files: () => Map<string, FileMetadata[]> },
): StorageProvider {
  const store = hooks.files;

  const bucket = (connectionId: string) => {
    const map = store();
    if (!map.has(connectionId)) map.set(connectionId, seedFilesFor(connectionId));
    return map.get(connectionId)!;
  };

  const find = (connectionId: string, fileId: string) =>
    bucket(connectionId).find((f) => f.id === fileId);

  return {
    descriptor,

    async connect(input) {
      const label = input["account"] || input["bucket"] || input["chat"] || "primary";
      const connection: Omit<Connection, "id" | "workspaceId"> = {
        providerId: descriptor.id,
        name: input["name"]?.trim() || `${descriptor.name} — ${label}`,
        accountLabel: label,
        status: "connected",
        quotaUsedBytes: Math.round(12_000_000_000 * (0.2 + Math.random() * 0.6)),
        quotaTotalBytes: 15_000_000_000,
        createdAt: new Date().toISOString(),
        config: Object.fromEntries(
          Object.entries(input).filter(([key]) => !["token", "secret"].includes(key)),
        ),
      };
      return connection;
    },

    async disconnect() {
      /* mock: nothing to revoke */
    },

    async refreshToken() {
      /* mock: tokens never expire */
    },

    async getUser(connectionId) {
      const user: ProviderUser = { id: connectionId, label: `${descriptor.name} demo account` };
      return user;
    },

    async list(connectionId, path = "/") {
      const target = normalizePath(path);
      return bucket(connectionId).filter((f) => f.path === target && !f.trashed);
    },

    async search(connectionId, query) {
      const needle = query.toLowerCase();
      return bucket(connectionId).filter((f) => !f.trashed && f.name.toLowerCase().includes(needle));
    },

    async upload(connectionId, file, path = "/") {
      const created: FileMetadata = {
        id: `${connectionId}-${crypto.randomUUID()}`,
        connectionId,
        name: file.name,
        path: normalizePath(path),
        kind: "file",
        mimeType: file.type || guessMimeType(file.name),
        sizeBytes: file.size,
        modifiedAt: new Date().toISOString(),
        favorite: false,
        trashed: false,
        providerFileId: `mock-${crypto.randomUUID()}`,
      };
      bucket(connectionId).push(created);
      return created;
    },

    async download(connectionId, fileId) {
      const target = find(connectionId, fileId);
      return new Blob([`odrive-mock-content:${target?.name ?? fileId}`], { type: "text/plain" });
    },

    async delete(connectionId, fileId) {
      const target = find(connectionId, fileId);
      if (target) target.trashed = true;
    },

    async rename(connectionId, fileId, newName) {
      const target = find(connectionId, fileId);
      if (target) target.name = newName;
    },

    async move(connectionId, fileId, targetPath) {
      const target = find(connectionId, fileId);
      if (target) target.path = normalizePath(targetPath);
    },

    async copy(connectionId, fileId, targetPath) {
      const target = find(connectionId, fileId);
      if (!target) throw new Error("File not found");
      const copied: FileMetadata = {
        ...target,
        id: `${connectionId}-${crypto.randomUUID()}`,
        name: `${target.name} (copy)`,
        path: normalizePath(targetPath),
        modifiedAt: new Date().toISOString(),
      };
      bucket(connectionId).push(copied);
      return copied;
    },

    async createFolder(connectionId, path, name) {
      const created: FileMetadata = {
        id: `${connectionId}-${crypto.randomUUID()}`,
        connectionId,
        name,
        path: normalizePath(path),
        kind: "folder",
        mimeType: "inode/directory",
        sizeBytes: 0,
        modifiedAt: new Date().toISOString(),
        favorite: false,
        trashed: false,
        providerFileId: joinPath(path, name),
      };
      bucket(connectionId).push(created);
      return created;
    },

    async getQuota(connectionId): Promise<Quota> {
      const used = bucket(connectionId)
        .filter((f) => !f.trashed)
        .reduce((total, f) => total + f.sizeBytes, 0);
      return { usedBytes: used, totalBytes: 15_000_000_000 };
    },

    async getMetadata(connectionId, fileId) {
      return find(connectionId, fileId) ?? null;
    },

    async healthCheck(): Promise<{ status: ProviderState["health"]; detail?: string }> {
      return { status: "healthy", detail: "mock adapter always available" };
    },
  };
}
