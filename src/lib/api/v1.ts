import { authenticateApiKey, type ApiPrincipal } from "@/core/api-keys";
import { useContainer } from "@/core/container";
import { listDrives } from "@/core/drives";
import { assertWithinLimit } from "@/core/rate-limit";
import {
  browse,
  copyFile,
  createFolder,
  deleteFile,
  getFile,
  listConnections,
  moveFile,
  queueTransfer,
  registerUpload,
  searchEverything,
} from "@/core/services";
import { listShares } from "@/core/shares";
import { createWebhook, listWebhooks, WEBHOOK_EVENTS } from "@/core/webhooks";
import type { WebhookEventType } from "@/core/types";
import { DEMO_WORKSPACE_ID } from "@/database/memory";

import {
  ApiError,
  fail,
  newRequestId,
  ok,
  paginate,
  readJson,
  requireScope,
  requireString,
  requireWorkspace,
} from "./http";
import { openApiDocument } from "./openapi";

/**
 * The public v1 API router. One provider-agnostic contract over every storage
 * backend: authentication, scope checks, workspace isolation, rate limiting and
 * request logging all happen here so route files stay trivial.
 */

/* ------------------------------ serialisers ------------------------------ */

const driveDto = (view: Awaited<ReturnType<typeof listDrives>>[number]) => ({
  id: view.drive.id,
  name: view.drive.name,
  workspace_id: view.drive.workspaceId,
  provider: view.connection.providerId,
  connection_id: view.connection.id,
  status: view.drive.status,
  is_default: view.drive.isDefault,
  created_at: view.drive.createdAt,
  last_sync_at: view.drive.lastSyncAt ?? null,
});

const fileDto = (file: {
  id: string;
  connectionId: string;
  name: string;
  path: string;
  kind: string;
  mimeType: string;
  sizeBytes: number;
  modifiedAt: string;
}) => ({
  id: file.id,
  name: file.name,
  path: file.path,
  kind: file.kind,
  mime_type: file.mimeType,
  size_bytes: file.sizeBytes,
  modified_at: file.modifiedAt,
  connection_id: file.connectionId,
});

/* -------------------------------- helpers -------------------------------- */

/** Resolves the connection ids a drive maps to, enforcing workspace isolation. */
async function connectionForDrive(principal: ApiPrincipal, driveId: string): Promise<string> {
  const view = (await listDrives()).find((candidate) => candidate.drive.id === driveId);
  if (!view) throw new ApiError("NOT_FOUND", "Drive not found.");
  requireWorkspace(principal, view.drive.workspaceId);
  return view.connection.id;
}

async function allConnectionIds(): Promise<string[]> {
  return (await listConnections()).map((connection) => connection.id);
}

/* -------------------------------- router --------------------------------- */

export async function handleApiRequest(request: Request, basePath: string): Promise<Response> {
  const requestId = newRequestId();
  const startedAt = Date.now();
  const url = new URL(request.url);
  const params = url.searchParams;
  const segments = url.pathname
    .replace(basePath, "")
    .split("/")
    .filter(Boolean)
    .map(decodeURIComponent);
  const method = request.method.toUpperCase();
  let principal: ApiPrincipal | null = null;
  let response: Response;

  try {
    if (segments[0] === "openapi.json") {
      return ok(openApiDocument, requestId);
    }

    principal = await authenticateApiKey(
      request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? null,
    );
    if (!principal) {
      throw new ApiError("UNAUTHORIZED", "Provide a valid API key as a Bearer token.");
    }
    assertWithinLimit("provider.call", principal.keyId);

    response = await route(request, method, segments, params, principal, requestId);
  } catch (error) {
    response =
      error instanceof ApiError
        ? fail(error.code, error.message, requestId)
        : fail(
            "INTERNAL_ERROR",
            "The request could not be completed. Reference the request id when reporting this.",
            requestId,
          );
    if (!(error instanceof ApiError)) console.error(error);
  }

  await useContainer()
    .apiRequestLogs.record({
      requestId,
      keyId: principal?.keyId ?? null,
      method,
      path: url.pathname,
      status: response.status,
      durationMs: Date.now() - startedAt,
    })
    .catch(() => undefined);

  return response;
}

async function route(
  request: Request,
  method: string,
  segments: string[],
  params: URLSearchParams,
  principal: ApiPrincipal,
  requestId: string,
): Promise<Response> {
  const [resource, id, action] = segments;

  /* ------------------------------ discovery ------------------------------ */
  if (resource === "me" && method === "GET") {
    return ok(
      { key_id: principal.keyId, workspace_id: principal.workspaceId, scopes: principal.scopes },
      requestId,
    );
  }

  if (resource === "workspaces") {
    requireScope(principal, "drive:read");
    if (!id && method === "GET") {
      const workspace = await useContainer().workspaces.get(principal.workspaceId);
      return ok(
        workspace ? [{ id: workspace.id, name: workspace.name }] : [],
        requestId,
      );
    }
    if (id && action === "drives" && method === "GET") {
      requireWorkspace(principal, id);
      const { page, meta } = paginate((await listDrives()).map(driveDto), params);
      return ok(page, requestId, meta);
    }
  }

  /* -------------------------------- drives ------------------------------- */
  if (resource === "drives") {
    if (!id && method === "GET") {
      requireScope(principal, "drive:read");
      const rows = (await listDrives())
        .filter((view) => view.drive.workspaceId === principal.workspaceId)
        .map(driveDto);
      const { page, meta } = paginate(rows, params);
      return ok(page, requestId, meta);
    }
    if (id && action === "files") {
      const connectionId = await connectionForDrive(principal, id);
      if (method === "GET") {
        requireScope(principal, "file:read");
        const path = params.get("path") ?? "/";
        const rows = (await browse([connectionId], path)).map(fileDto);
        const { page, meta } = paginate(rows, params);
        return ok(page, requestId, { ...meta, path });
      }
      if (method === "POST") {
        requireScope(principal, "file:write");
        const body = await readJson(request);
        const created = await registerUpload({
          connectionId,
          path: typeof body["path"] === "string" ? body["path"] : "/",
          name: requireString(body, "name"),
          sizeBytes: Number(body["size_bytes"] ?? 0),
          ...(typeof body["mime_type"] === "string" ? { mimeType: body["mime_type"] } : {}),
        });
        return ok(fileDto(created), requestId);
      }
    }
    if (id && action === "folders" && method === "POST") {
      requireScope(principal, "drive:write");
      const connectionId = await connectionForDrive(principal, id);
      const body = await readJson(request);
      const created = await createFolder(
        connectionId,
        typeof body["path"] === "string" ? body["path"] : "/",
        requireString(body, "name"),
      );
      return ok(fileDto(created), requestId);
    }
  }

  /* -------------------------------- files -------------------------------- */
  if (resource === "files" && id) {
    const file = await getFile(id);
    if (!file) throw new ApiError("FILE_NOT_FOUND", "File not found.");

    if (!action && method === "GET") {
      requireScope(principal, "file:read");
      return ok(fileDto(file), requestId);
    }
    if (!action && method === "PATCH") {
      requireScope(principal, "file:write");
      const body = await readJson(request);
      const patch: Record<string, unknown> = {};
      if (typeof body["name"] === "string") patch["name"] = body["name"];
      if (typeof body["favorite"] === "boolean") patch["favorite"] = body["favorite"];
      if (typeof body["trashed"] === "boolean") patch["trashed"] = body["trashed"];
      const updated = await useContainer().files.update(id, patch);
      return ok(fileDto(updated), requestId);
    }
    if (!action && method === "DELETE") {
      requireScope(principal, "file:write");
      await deleteFile(id);
      return ok({ id, deleted: true }, requestId);
    }
    if (action === "move" && method === "POST") {
      requireScope(principal, "file:write");
      const body = await readJson(request);
      return ok(fileDto(await moveFile(id, requireString(body, "path"))), requestId);
    }
    if (action === "copy" && method === "POST") {
      requireScope(principal, "file:write");
      const body = await readJson(request);
      const created = await copyFile(id, {
        ...(typeof body["path"] === "string" ? { path: body["path"] } : {}),
        ...(typeof body["name"] === "string" ? { name: body["name"] } : {}),
      });
      return ok(fileDto(created), requestId);
    }
    if (action === "download" && method === "GET") {
      requireScope(principal, "file:read");
      const expiresAt = new Date(Date.now() + 300_000).toISOString();
      return ok(
        {
          id: file.id,
          name: file.name,
          url: `/api/v1/files/${file.id}/content?exp=${Date.parse(expiresAt)}`,
          expires_at: expiresAt,
        },
        requestId,
      );
    }
  }

  /* ------------------------------- uploads ------------------------------- */
  if (resource === "uploads") {
    requireScope(principal, "file:write");
    if (!id && method === "POST") {
      const body = await readJson(request);
      const driveId = requireString(body, "drive_id");
      await connectionForDrive(principal, driveId);
      return ok(
        {
          id: `upl_${crypto.randomUUID().replace(/-/g, "").slice(0, 20)}`,
          drive_id: driveId,
          name: requireString(body, "name"),
          size_bytes: Number(body["size_bytes"] ?? 0),
          chunk_size_bytes: 8 * 1024 * 1024,
          status: "awaiting_chunks",
          expires_at: new Date(Date.now() + 3_600_000).toISOString(),
        },
        requestId,
      );
    }
    if (id && action === "chunks" && method === "PUT") {
      return ok({ upload_id: id, received: true }, requestId);
    }
    if (id && action === "complete" && method === "POST") {
      const body = await readJson(request);
      const connectionId = await connectionForDrive(principal, requireString(body, "drive_id"));
      const created = await registerUpload({
        connectionId,
        path: typeof body["path"] === "string" ? body["path"] : "/",
        name: requireString(body, "name"),
        sizeBytes: Number(body["size_bytes"] ?? 0),
      });
      return ok({ upload_id: id, file: fileDto(created) }, requestId);
    }
  }

  /* ---------------------------- transfers/jobs --------------------------- */
  if (resource === "transfers" && !id && method === "POST") {
    requireScope(principal, "transfer:write");
    const body = await readJson(request);
    const connectionId = await connectionForDrive(principal, requireString(body, "drive_id"));
    const job = await queueTransfer({
      connectionId,
      fileName: requireString(body, "name"),
      direction: body["direction"] === "download" ? "download" : "upload",
      sizeBytes: Number(body["size_bytes"] ?? 0),
    });
    return ok({ id: job.id, status: job.status, progress: job.progress }, requestId);
  }

  if (resource === "jobs" && id && method === "GET") {
    requireScope(principal, "transfer:write");
    const job = (await useContainer().jobs.get(id)) ?? null;
    const transfer = job ? null : await useContainer().transfers.get(id);
    if (!job && !transfer) throw new ApiError("NOT_FOUND", "Job not found.");
    return ok(
      job
        ? { id: job.id, kind: job.kind, status: job.status, attempts: job.attempts }
        : { id: transfer!.id, kind: `transfer.${transfer!.direction}`, status: transfer!.status, progress: transfer!.progress },
      requestId,
    );
  }

  /* -------------------------------- search ------------------------------- */
  if (resource === "search" && method === "GET") {
    requireScope(principal, "file:read");
    const term = params.get("q") ?? "";
    if (!term.trim()) throw new ApiError("VALIDATION_ERROR", 'Query parameter "q" is required.');
    const results = await searchEverything(term, await allConnectionIds());
    const { page, meta } = paginate(
      results.map((result) => ({ ...fileDto(result.file), provider: result.providerId })),
      params,
    );
    return ok(page, requestId, meta);
  }

  /* ----------------------------- connections ----------------------------- */
  if (resource === "connections" && !id && method === "GET") {
    requireScope(principal, "drive:read");
    const rows = (await listConnections()).map((connection) => ({
      id: connection.id,
      name: connection.name,
      provider: connection.providerId,
      status: connection.status,
      created_at: connection.createdAt,
    }));
    const { page, meta } = paginate(rows, params);
    return ok(page, requestId, meta);
  }

  /* -------------------------------- shares ------------------------------- */
  if (resource === "shares" && !id && method === "GET") {
    requireScope(principal, "share:read");
    const rows = (await listShares()).map((view) => ({
      id: view.share.id,
      token: view.share.token,
      status: view.share.status,
      resource_kind: view.share.resourceKind,
      expires_at: view.share.expiresAt ?? null,
      created_at: view.share.createdAt,
    }));
    const { page, meta } = paginate(rows, params);
    return ok(page, requestId, meta);
  }

  /* ------------------------------- webhooks ------------------------------ */
  if (resource === "webhooks" && !id) {
    requireScope(principal, "webhook:write");
    if (method === "GET") {
      const rows = (await listWebhooks(principal.workspaceId)).map((endpoint) => ({
        id: endpoint.id,
        url: endpoint.url,
        events: endpoint.events,
        status: endpoint.status,
        secret: endpoint.secretMasked,
        created_at: endpoint.createdAt,
      }));
      const { page, meta } = paginate(rows, params);
      return ok(page, requestId, meta);
    }
    if (method === "POST") {
      const body = await readJson(request);
      const events = Array.isArray(body["events"])
        ? (body["events"] as string[]).filter((event): event is WebhookEventType =>
            WEBHOOK_EVENTS.includes(event as WebhookEventType),
          )
        : [];
      const { endpoint, secret } = await createWebhook({
        url: requireString(body, "url"),
        events,
        workspaceId: principal.workspaceId === DEMO_WORKSPACE_ID ? undefined : principal.workspaceId,
      });
      return ok(
        { id: endpoint.id, url: endpoint.url, events: endpoint.events, secret },
        requestId,
      );
    }
  }

  throw new ApiError(
    "NOT_FOUND",
    `No v1 endpoint matches ${method} /${segments.join("/")}.`,
  );
}
