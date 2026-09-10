import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Returns the signed-in operator plus the workspace they own, provisioning it once. */
export const getSessionUser = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { resolveWorkspace } = await import("@/lib/repositories.server");
    const { postgresAdapter } = await import("@/database/postgres.server");

    const email = typeof context.claims["email"] === "string" ? context.claims["email"] : "";
    const { workspaceId, role } = await resolveWorkspace(context.userId, email);
    const profile = await postgresAdapter.selectOne("profiles", [
      { column: "id", op: "eq", value: context.userId },
    ]);

    return {
      id: context.userId,
      email,
      displayName: typeof profile?.["display_name"] === "string" ? profile["display_name"] : "",
      workspaceId,
      role,
    };
  });
