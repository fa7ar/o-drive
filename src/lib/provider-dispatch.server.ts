/**
 * Server-side dispatch for live provider operations. Keeps vendor code out of
 * the client bundle and out of the RPC layer.
 */
import type { FileMetadata } from "@/core/types";
import { joinPath, parentPath } from "@/core/vfs";
import {
  driveCopy,
  driveCreateFolder,
  driveDelete,
  driveDownloadUrlBytes,
  driveList,
  driveMetadata,
  driveMove,
  driveQuota,
  driveRename,
  driveSearch,
  driveUpload,
} from "./google-drive.server";
import {
  s3CopyKey,
  s3CreateFolder,
  s3Delete,
  s3Download,
  s3Head,
  s3Health,
  s3ListPath,
  s3Quota,
  s3StreamChunk,
  s3Upload,
} from "./s3-ops.server";

interface Call {
  connectionId: string;
  providerId: string;
  op: string;
  args: Record<string, unknown>;
}

const str = (args: Record<string, unknown>, key: string, fallback = "") =>
  typeof args[key] === "string" ? (args[key] as string) : fallback;

export async function dispatch(call: Call): Promise<unknown> {
  const { connectionId, providerId, op, args } = call;

  if (providerId === "google-drive") {
    switch (op) {
      case "list":
        return driveList(connectionId, str(args, "path", "/"));
      case "search":
        return driveSearch(connectionId, str(args, "query"));
      case "createFolder":
        return driveCreateFolder(connectionId, str(args, "path", "/"), str(args, "name"));
      case "upload":
        return driveUpload(connectionId, str(args, "path", "/"), {
          name: str(args, "name"),
          type: str(args, "type"),
          bytes: new Uint8Array(0),
        });
      case "download":
        return driveDownloadUrlBytes(connectionId, str(args, "fileId"));
      case "delete":
        return driveDelete(connectionId, str(args, "fileId"));
      case "rename":
        return driveRename(connectionId, str(args, "fileId"), str(args, "name"));
      case "move":
        return driveMove(connectionId, str(args, "fileId"), str(args, "path", "/"));
      case "copy":
        return driveCopy(connectionId, str(args, "fileId"), str(args, "path", "/"));
      case "metadata":
        return driveMetadata(connectionId, str(args, "fileId"));
      case "quota":
      case "user": {
        const quota = await driveQuota(connectionId);
        return op === "quota"
          ? { usedBytes: quota.usedBytes, totalBytes: quota.totalBytes }
          : { id: connectionId, label: quota.displayName || quota.email, email: quota.email };
      }
      case "health":
        return { status: "healthy" };
      case "refresh":
        return { ok: true };
      default:
        throw new Error(`Unsupported operation "${op}"`);
    }
  }

  if (providerId === "r2" || providerId === "s3") {
    switch (op) {
      case "list":
        return s3ListPath(connectionId, providerId, str(args, "path", "/"));
      case "search": {
        const all = await s3ListPath(connectionId, providerId, "/");
        const needle = str(args, "query").toLowerCase();
        return all.filter((file: FileMetadata) => file.name.toLowerCase().includes(needle));
      }
      case "createFolder":
        return s3CreateFolder(connectionId, providerId, str(args, "path", "/"), str(args, "name"));
      case "upload":
        return s3Upload(connectionId, providerId, str(args, "path", "/"), {
          name: str(args, "name"),
          type: str(args, "type"),
          bytes: new Uint8Array(0),
        });
      case "download":
        return s3Download(connectionId, providerId, str(args, "fileId"));
      case "stream": {
        const num = (key: string, fallback: number) =>
          typeof args[key] === "number" ? (args[key] as number) : fallback;
        return s3StreamChunk(
          connectionId,
          providerId,
          str(args, "fileId"),
          num("offset", 0),
          num("length", 4 * 1024 * 1024),
        );
      }
      case "delete":
        return s3Delete(connectionId, providerId, str(args, "fileId"));
      case "rename": {
        const key = str(args, "fileId");
        const target = joinPath(parentPath(`/${key}`), str(args, "name")).slice(1);
        await s3CopyKey(connectionId, providerId, key, target);
        return s3Delete(connectionId, providerId, key);
      }
      case "move": {
        const key = str(args, "fileId");
        const name = key.split("/").pop() ?? key;
        const target = joinPath(str(args, "path", "/"), name).slice(1);
        await s3CopyKey(connectionId, providerId, key, target);
        return s3Delete(connectionId, providerId, key);
      }
      case "copy": {
        const key = str(args, "fileId");
        const name = key.split("/").pop() ?? key;
        const target = joinPath(str(args, "path", "/"), `copy-${name}`).slice(1);
        await s3CopyKey(connectionId, providerId, key, target);
        return { ok: true };
      }
      case "quota":
        return s3Quota(connectionId, providerId);
      case "user":
        return { id: connectionId, label: `${providerId.toUpperCase()} bucket` };
      case "metadata":
        return s3Head(connectionId, providerId, str(args, "fileId"));
      case "health":
        return { status: (await s3Health(connectionId, providerId)) ? "healthy" : "degraded" };
      case "refresh":
        return { ok: true };
      default:
        throw new Error(`Unsupported operation "${op}"`);
    }
  }

  throw new Error(`No live implementation for provider "${providerId}"`);
}
