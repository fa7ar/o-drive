import { postgresAdapter } from "@/database/postgres.server";
import {
  createPostgresRepositories,
  type RepositoryBundle,
} from "@/database/postgres-repositories.server";

/**
 * Server-side repository factory. Every caller must name the workspace it has
 * already authenticated, which is what makes cross-workspace access impossible.
 */
export function serverRepositories(input: {
  workspaceId: string;
  userId: string;
  email?: string;
}): RepositoryBundle {
  return createPostgresRepositories(postgresAdapter, {
    workspaceId: input.workspaceId,
    userId: input.userId,
    email: input.email ?? "",
  });
}

/** Resolves (and if needed provisions) the workspace owned by a signed-in user. */
export async function resolveWorkspace(
  userId: string,
  email: string,
  db = postgresAdapter,
): Promise<{ workspaceId: string; role: string }> {
  const profile = await db.selectOne("profiles", [{ column: "id", op: "eq", value: userId }]);

  let workspaceId = profile ? String(profile["workspace_id"]) : null;

  if (!workspaceId) {
    const workspace = await db.insert("workspaces", { name: "My Workspace" });
    workspaceId = String(workspace["id"]);
    await db.insert("profiles", {
      id: userId,
      workspace_id: workspaceId,
      email,
      display_name: "",
    });
    await db.upsert("user_roles", [{ user_id: userId, role: "owner" }], "user_id,role");
    await db.upsert(
      "workspace_settings",
      [{ workspace_id: workspaceId, data: {} }],
      "workspace_id",
    );
  }

  const roles = await db.select("user_roles", {
    filters: [{ column: "user_id", op: "eq", value: userId }],
  });
  const role = roles.some((row) => row["role"] === "owner")
    ? "owner"
    : roles.some((row) => row["role"] === "admin")
      ? "admin"
      : "member";

  return { workspaceId, role };
}
