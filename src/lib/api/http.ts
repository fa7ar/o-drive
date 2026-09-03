import type { ApiScope } from "@/core/types";
import { hasScope, type ApiPrincipal } from "@/core/api-keys";

/**
 * Transport helpers for the public v1 API: standardized envelopes, request
 * ids, cursor pagination and an error mapper that never leaks internals.
 */

export type ApiErrorCode =
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "INSUFFICIENT_SCOPE"
  | "NOT_FOUND"
  | "FILE_NOT_FOUND"
  | "VALIDATION_ERROR"
  | "CAPABILITY_NOT_SUPPORTED"
  | "RATE_LIMITED"
  | "METHOD_NOT_ALLOWED"
  | "INTERNAL_ERROR";

const STATUS: Record<ApiErrorCode, number> = {
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  INSUFFICIENT_SCOPE: 403,
  NOT_FOUND: 404,
  FILE_NOT_FOUND: 404,
  VALIDATION_ERROR: 422,
  CAPABILITY_NOT_SUPPORTED: 400,
  RATE_LIMITED: 429,
  METHOD_NOT_ALLOWED: 405,
  INTERNAL_ERROR: 500,
};

export class ApiError extends Error {
  constructor(
    readonly code: ApiErrorCode,
    message: string,
  ) {
    super(message);
  }
}

export const newRequestId = () =>
  `req_${[...crypto.getRandomValues(new Uint8Array(8))]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("")}`;

const baseHeaders = (requestId: string) => ({
  "content-type": "application/json",
  "cache-control": "no-store",
  "x-request-id": requestId,
});

export function ok(data: unknown, requestId: string, meta?: Record<string, unknown>): Response {
  return new Response(JSON.stringify(meta ? { data, meta } : { data }), {
    status: 200,
    headers: baseHeaders(requestId),
  });
}

export function fail(code: ApiErrorCode, message: string, requestId: string): Response {
  return new Response(
    JSON.stringify({ error: { code, message, request_id: requestId } }),
    { status: STATUS[code], headers: baseHeaders(requestId) },
  );
}

/** Cursor pagination over an already-materialised, stably ordered list. */
export function paginate<T>(
  rows: T[],
  params: URLSearchParams,
): { page: T[]; meta: Record<string, unknown> } {
  const limit = Math.min(Math.max(Number(params.get("limit") ?? 50), 1), 100);
  const cursor = Number(params.get("cursor") ?? 0) || 0;
  const page = rows.slice(cursor, cursor + limit);
  const next = cursor + limit;
  return {
    page,
    meta: {
      limit,
      cursor,
      next_cursor: next < rows.length ? String(next) : null,
      has_more: next < rows.length,
      total: rows.length,
    },
  };
}

export function requireScope(principal: ApiPrincipal, scope: ApiScope): void {
  if (!hasScope(principal, scope)) {
    throw new ApiError("INSUFFICIENT_SCOPE", `This API key is missing the ${scope} scope.`);
  }
}

/** Workspace isolation: client-supplied ids are always re-checked. */
export function requireWorkspace(principal: ApiPrincipal, workspaceId: string): void {
  if (workspaceId !== principal.workspaceId) {
    throw new ApiError("NOT_FOUND", "The requested workspace could not be found.");
  }
}

export async function readJson(request: Request): Promise<Record<string, unknown>> {
  try {
    const body = await request.json();
    if (!body || typeof body !== "object") throw new Error("bad body");
    return body as Record<string, unknown>;
  } catch {
    throw new ApiError("VALIDATION_ERROR", "Request body must be a JSON object.");
  }
}

export function requireString(body: Record<string, unknown>, key: string): string {
  const value = body[key];
  if (typeof value !== "string" || !value.trim()) {
    throw new ApiError("VALIDATION_ERROR", `Field "${key}" is required.`);
  }
  return value.trim();
}
