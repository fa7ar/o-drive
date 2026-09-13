import { createFileRoute } from "@tanstack/react-router";

import { configStatus } from "@/config/runtime-env.server";

/**
 * Post-deploy configuration check. Reports presence booleans only — never a
 * value, never a partial value. Returns 503 while required config is missing so
 * an automated deploy check can fail on it.
 */
export const Route = createFileRoute("/api/public/health/config")({
  server: {
    handlers: {
      GET: () => {
        const status = configStatus();
        return new Response(
          JSON.stringify({
            status: status.ok ? "configured" : "misconfigured",
            environment: status.environment,
            missingRequired: status.missingRequired,
            variables: status.variables,
            checkedAt: new Date().toISOString(),
          }),
          {
            status: status.ok ? 200 : 503,
            headers: { "content-type": "application/json", "cache-control": "no-store" },
          },
        );
      },
    },
  },
});
