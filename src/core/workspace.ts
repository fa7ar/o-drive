/**
 * Sentinel workspace id used by client-side callers.
 *
 * The browser never decides which workspace it is allowed to read. Every
 * repository call is resolved on the server from the authenticated session, so
 * callers pass this placeholder and the server substitutes the real id.
 */
export const CURRENT_WORKSPACE = "current";
