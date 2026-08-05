import type { Connection, FileMetadata, ProviderDescriptor, StorageProvider } from "@/core/types";

/**
 * Mock adapter factory. Real adapters replace the method bodies with vendor
 * SDK calls; the interface and every call site stay identical.
 */

const SAMPLE_TREE: Array<Omit<FileMetadata, "id" | "connectionId">> = [
  {
    name: "Projects",
    path: "/",
    kind: "folder",
    mimeType: "inode/directory",
    sizeBytes: 0,
    modifiedAt: "2026-07-28T09:12:00Z",
    favorite: true,
    trashed: false,
  },
  {
    name: "Invoices",
    path: "/",
    kind: "folder",
    mimeType: "inode/directory",
    sizeBytes: 0,
    modifiedAt: "2026-07-21T14:02:00Z",
    favorite: false,
    trashed: false,
  },
  {
    name: "quarterly-report.pdf",
    path: "/",
    kind: "file",
    mimeType: "application/pdf",
    sizeBytes: 2_412_000,
    modifiedAt: "2026-08-01T11:40:00Z",
    favorite: true,
    trashed: false,
  },
  {
    name: "team-photo.jpg",
    path: "/",
    kind: "file",
    mimeType: "image/jpeg",
    sizeBytes: 5_180_000,
    modifiedAt: "2026-07-30T18:05:00Z",
    favorite: false,
    trashed: false,
  },
  {
    name: "architecture.md",
    path: "/Projects",
    kind: "file",
    mimeType: "text/markdown",
    sizeBytes: 18_400,
    modifiedAt: "2026-08-02T08:15:00Z",
    favorite: false,
    trashed: false,
  },
  {
    name: "odrive-spec.md",
    path: "/Projects",
    kind: "file",
    mimeType: "text/markdown",
    sizeBytes: 22_900,
    modifiedAt: "2026-08-03T16:45:00Z",
    favorite: true,
    trashed: false,
  },
  {
    name: "backup-2025.zip",
    path: "/Invoices",
    kind: "file",
    mimeType: "application/zip",
    sizeBytes: 184_000_000,
    modifiedAt: "2026-06-11T10:00:00Z",
    favorite: false,
    trashed: false,
  },
  {
    name: "old-draft.docx",
    path: "/",
    kind: "file",
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    sizeBytes: 88_000,
    modifiedAt: "2026-05-02T10:00:00Z",
    favorite: false,
    trashed: true,
  },
];

export function seedFilesFor(connectionId: string): FileMetadata[] {
  return SAMPLE_TREE.map((file, index) => ({
    ...file,
    id: `${connectionId}-f${index}`,
    connectionId,
  }));
}

export function createMockAdapter(
  descriptor: ProviderDescriptor,
  hooks: {
    files: () => Map<string, FileMetadata[]>;
  },
): StorageProvider {
  const store = hooks.files;

  const bucket = (connectionId: string) => {
    const map = store();
    if (!map.has(connectionId)) map.set(connectionId, seedFilesFor(connectionId));
    return map.get(connectionId)!;
  };

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
      };
      return connection;
    },

    async disconnect() {
      /* mock: nothing to revoke */
    },

    async upload(connectionId, file) {
      const created: FileMetadata = {
        id: `${connectionId}-${crypto.randomUUID()}`,
        connectionId,
        name: file.name,
        path: "/",
        kind: "file",
        mimeType: "application/octet-stream",
        sizeBytes: file.size,
        modifiedAt: new Date().toISOString(),
        favorite: false,
        trashed: false,
      };
      bucket(connectionId).push(created);
      return created;
    },

    async download() {
      return new Blob(["odrive-mock-content"], { type: "text/plain" });
    },

    async list(connectionId, path = "/") {
      return bucket(connectionId).filter((f) => f.path === path && !f.trashed);
    },

    async delete(connectionId, fileId) {
      const files = bucket(connectionId);
      const target = files.find((f) => f.id === fileId);
      if (target) target.trashed = true;
    },

    async rename(connectionId, fileId, newName) {
      const target = bucket(connectionId).find((f) => f.id === fileId);
      if (target) target.name = newName;
    },

    async search(connectionId, query) {
      const q = query.toLowerCase();
      return bucket(connectionId).filter((f) => !f.trashed && f.name.toLowerCase().includes(q));
    },
  };
}
