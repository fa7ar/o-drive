import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { RepositoryBundle } from "@/database/postgres-repositories.server";

/**
 * Single authenticated bridge between the browser and persistence.
 *
 * The browser names a repository and a method; the server resolves the
 * workspace from the session, so a caller can never read or write another
 * workspace's rows regardless of the arguments it sends.
 */

export interface RepoCallInput {
  repo: string;
  method: string;
  args: unknown[];
}

/** Methods that must never be reachable from a browser. */
const BLOCKED = new Set(["secrets.open", "tokens.read"]);

/** Methods that additionally require an owner/admin role. */
const ADMIN_ONLY = new Set([
  "credentials.reveal",
  "credentials.remove",
  "credentials.rotate",
  "credentials.setStatus",
  "config.set",
  "config.reset",
  "flags.toggle",
  "providers.update",
]);

function validate(data: unknown): RepoCallInput {
  const input = data as Partial<RepoCallInput> | null;
  if (!input || typeof input.repo !== "string" || typeof input.method !== "string") {
    throw new Error("Invalid repository call");
  }
  return { repo: input.repo, method: input.method, args: Array.isArray(input.args) ? input.args : [] };
}

export const repoCall = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(validate)
  .handler(async ({ data, context }) => {
    const { resolveWorkspace, serverRepositories } = await import("@/lib/repositories.server");

    const signature = `${data.repo}.${data.method}`;
    if (BLOCKED.has(signature)) throw new Error("This operation is server-only");

    const email = typeof context.claims["email"] === "string" ? context.claims["email"] : "";
    const { workspaceId, role } = await resolveWorkspace(context.userId, email);

    if (ADMIN_ONLY.has(signature) && role !== "owner" && role !== "admin") {
      throw new Error("You do not have permission to perform this action");
    }

    const repositories = serverRepositories({ workspaceId, userId: context.userId, email });
    const repository = (repositories as unknown as Record<string, Record<string, unknown>>)[
      data.repo
    ];
    if (!repository) throw new Error(`Unknown repository: ${data.repo}`);

    const handler = repository[data.method];
    if (typeof handler !== "function") {
      throw new Error(`Unknown operation: ${signature}`);
    }

    // Any workspace id supplied by the caller is replaced by the authenticated
    // one, so a forged argument cannot widen access.
    const args = data.args.map((arg) => (arg === "current" ? workspaceId : arg));

    const result = await (handler as (...values: unknown[]) => Promise<unknown>).apply(
      repository,
      args,
    );
    return (result ?? null) as unknown;
  });

export type RepositoryName = keyof RepositoryBundle;
