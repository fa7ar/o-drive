/**
 * Normalised error model. Raw provider/vendor errors never reach the UI — they
 * are mapped to a stable code plus a human sentence the user can act on.
 */

export type ErrorCode =
  | "AUTH_REQUIRED"
  | "SESSION_EXPIRED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "VALIDATION_FAILED"
  | "RATE_LIMITED"
  | "CONFLICT"
  | "PROVIDER_UNAVAILABLE"
  | "PROVIDER_AUTH_EXPIRED"
  | "PROVIDER_QUOTA_EXCEEDED"
  | "FILE_TOO_LARGE"
  | "UNSUPPORTED_MEDIA_TYPE"
  | "PATH_INVALID"
  | "URL_NOT_ALLOWED"
  | "INTERNAL_ERROR";

export const HTTP_STATUS: Record<ErrorCode, number> = {
  AUTH_REQUIRED: 401,
  SESSION_EXPIRED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  VALIDATION_FAILED: 422,
  RATE_LIMITED: 429,
  CONFLICT: 409,
  PROVIDER_UNAVAILABLE: 502,
  PROVIDER_AUTH_EXPIRED: 401,
  PROVIDER_QUOTA_EXCEEDED: 507,
  FILE_TOO_LARGE: 413,
  UNSUPPORTED_MEDIA_TYPE: 415,
  PATH_INVALID: 400,
  URL_NOT_ALLOWED: 400,
  INTERNAL_ERROR: 500,
};

/** Copy shown to end users. Never includes vendor names of internal systems. */
const MESSAGES: Record<ErrorCode, string> = {
  AUTH_REQUIRED: "Please sign in to continue.",
  SESSION_EXPIRED: "Your session expired. Sign in again to continue.",
  FORBIDDEN: "You don't have access to this resource.",
  NOT_FOUND: "We couldn't find that item.",
  VALIDATION_FAILED: "Some details are missing or invalid.",
  RATE_LIMITED: "Too many attempts. Please wait a moment and try again.",
  CONFLICT: "That change conflicts with the current state. Refresh and retry.",
  PROVIDER_UNAVAILABLE: "This storage provider is temporarily unavailable. We'll retry shortly.",
  PROVIDER_AUTH_EXPIRED: "This drive's connection has expired. Reconnect the account to continue.",
  PROVIDER_QUOTA_EXCEEDED: "This account is out of storage space.",
  FILE_TOO_LARGE: "That file is larger than the upload limit.",
  UNSUPPORTED_MEDIA_TYPE: "That file type isn't allowed.",
  PATH_INVALID: "That folder path isn't valid.",
  URL_NOT_ALLOWED: "That URL isn't allowed.",
  INTERNAL_ERROR: "Something went wrong on our side. The team has been notified.",
};

export class ODriveError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly retryable: boolean;
  /** Safe structured context — never secrets. */
  readonly context: Record<string, unknown>;

  constructor(
    code: ErrorCode,
    options: { message?: string; retryable?: boolean; context?: Record<string, unknown> } = {},
  ) {
    super(options.message ?? MESSAGES[code]);
    this.name = "ODriveError";
    this.code = code;
    this.status = HTTP_STATUS[code];
    this.retryable =
      options.retryable ??
      (code === "PROVIDER_UNAVAILABLE" || code === "RATE_LIMITED" || code === "INTERNAL_ERROR");
    this.context = options.context ?? {};
  }
}

export const fail = (code: ErrorCode, message?: string): never => {
  throw new ODriveError(code, message ? { message } : {});
};

const PATTERNS: Array<[RegExp, ErrorCode]> = [
  [/invalid[_ ]grant|token (has )?expired|unauthorized_client|reconnect/i, "PROVIDER_AUTH_EXPIRED"],
  [/quota|storage.*full|insufficient (storage|space)/i, "PROVIDER_QUOTA_EXCEEDED"],
  [/rate.?limit|too many requests|429/i, "RATE_LIMITED"],
  [/not ?found|404|no such (file|key|bucket)/i, "NOT_FOUND"],
  [/forbidden|access denied|403/i, "FORBIDDEN"],
  [/timeout|ECONNRESET|network|fetch failed|502|503|504/i, "PROVIDER_UNAVAILABLE"],
];

/** Maps any thrown value to an ODriveError without leaking stack traces. */
export function normalizeError(error: unknown): ODriveError {
  if (error instanceof ODriveError) return error;
  const raw = error instanceof Error ? error.message : String(error ?? "");
  for (const [pattern, code] of PATTERNS) {
    if (pattern.test(raw)) return new ODriveError(code);
  }
  return new ODriveError("INTERNAL_ERROR");
}

/** The only string that should ever be rendered for a caught error. */
export const userMessage = (error: unknown): string => normalizeError(error).message;
