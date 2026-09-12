import type { FileMetadata, ProviderDescriptor, ProviderState, StorageProvider } from "@/core/types";
import { normalizePath } from "@/core/vfs";
import { providerCall } from "@/lib/providers.functions";

/**
 * Live adapter shell. Every vendor call is proxied through a server function so
 * credentials never reach the browser. When the provider has no credentials the
 * adapter transparently falls back to its mock twin, which keeps the product
 * usable in demo mode.
 */
export function createLiveAdapter(
  descriptor: ProviderDescriptor,
  hooks: { fallback: () => StorageProvider },
): StorageProvider {
  const mock = hooks.fallback();

  const call = async <T,>(
    op: string,
    connectionId: string,
    args: Record<string, unknown>,
    fallback: () => Promise<T>,
  ): Promise<T> => {
    try {
      const result = await providerCall({
        data: { connectionId, providerId: descriptor.id, op: op as never, args },
      });
      return JSON.parse(result.json) as T;
    } catch {
      return fallback();
    }
  };

  const fileId = (value: string) => (value.includes(":") ? value.slice(value.indexOf(":") + 1) : value);

  return {
    descriptor,
    connect: (input) => mock.connect(input),
    disconnect: (connectionId) => mock.disconnect(connectionId),
    refreshToken: (connectionId) =>
      call<void>("refresh", connectionId, {}, () => mock.refreshToken(connectionId)),
    getUser: (connectionId) => call("user", connectionId, {}, () => mock.getUser(connectionId)),
    list: (connectionId, path = "/") =>
      call<FileMetadata[]>("list", connectionId, { path: normalizePath(path) }, () =>
        mock.list(connectionId, path),
      ),
    search: (connectionId, query) =>
      call<FileMetadata[]>("search", connectionId, { query }, () => mock.search(connectionId, query)),
    upload: (connectionId, file, path = "/") =>
      call<FileMetadata>(
        "upload",
        connectionId,
        { path: normalizePath(path), name: file.name, size: file.size, type: file.type ?? "" },
        () => mock.upload(connectionId, file, path),
      ),
    download: async (connectionId, id) => {
      const base64 = await call<string | null>("download", connectionId, { fileId: fileId(id) }, async () => null);
      if (!base64) return mock.download(connectionId, id);
      return new Blob([Uint8Array.from(atob(base64), (c) => c.charCodeAt(0))]);
    },
    delete: (connectionId, id) =>
      call<void>("delete", connectionId, { fileId: fileId(id) }, () => mock.delete(connectionId, id)),
    rename: (connectionId, id, newName) =>
      call<void>("rename", connectionId, { fileId: fileId(id), name: newName }, () =>
        mock.rename(connectionId, id, newName),
      ),
    move: (connectionId, id, targetPath) =>
      call<void>("move", connectionId, { fileId: fileId(id), path: normalizePath(targetPath) }, () =>
        mock.move(connectionId, id, targetPath),
      ),
    copy: (connectionId, id, targetPath) =>
      call<FileMetadata>(
        "copy",
        connectionId,
        { fileId: fileId(id), path: normalizePath(targetPath) },
        () => mock.copy(connectionId, id, targetPath),
      ),
    createFolder: (connectionId, path, name) =>
      call<FileMetadata>("createFolder", connectionId, { path: normalizePath(path), name }, () =>
        mock.createFolder(connectionId, path, name),
      ),
    getQuota: (connectionId) => call("quota", connectionId, {}, () => mock.getQuota(connectionId)),
    getMetadata: (connectionId, id) =>
      call<FileMetadata | null>("metadata", connectionId, { fileId: fileId(id) }, () =>
        mock.getMetadata(connectionId, id),
      ),
    streamChunk: async (connectionId, id, offset, length) => {
      const chunk = await call<{
        base64: string;
        totalBytes: number;
        done: boolean;
        contentType: string;
      } | null>("stream", connectionId, { fileId: fileId(id), offset, length }, async () => null);
      if (!chunk) {
        const blob = await mock.download(connectionId, id);
        const bytes = new Uint8Array(await blob.arrayBuffer());
        return {
          bytes,
          totalBytes: bytes.byteLength,
          done: true,
          contentType: blob.type || "application/octet-stream",
        };
      }
      return {
        bytes: Uint8Array.from(atob(chunk.base64), (c) => c.charCodeAt(0)),
        totalBytes: chunk.totalBytes,
        done: chunk.done,
        contentType: chunk.contentType,
      };
    },
    healthCheck: async (connectionId?: string) => {
      if (!connectionId) {
        return {
          status: "unknown" as ProviderState["health"],
          detail: `${descriptor.name} adapter registered, no connection probed`,
        };
      }
      const probe = await call<{ status: ProviderState["health"] } | null>(
        "health",
        connectionId,
        {},
        async () => null,
      );
      return probe
        ? { status: probe.status, detail: `${descriptor.name} responded to a live probe` }
        : { status: "down" as ProviderState["health"], detail: `${descriptor.name} probe failed` };
    },
  };
}
