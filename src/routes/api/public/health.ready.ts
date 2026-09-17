import { createFileRoute } from "@tanstack/react-router";

import { readinessReport } from "@/core/readiness";

/**
 * Readiness probe: reports dependency checks without leaking configuration.
 * Only presence booleans are exposed — never values.
 */
export const Route = createFileRoute("/api/public/health/ready")({
  server: {
    handlers: {
      GET: async () => {
        const report = await readinessReport();
        const ready = report.deployment !== "BLOCKED";
        return new Response(
          JSON.stringify({
            status: ready ? "ready" : "not_ready",
            deployment: report.deployment,
            reason: report.reason,
            blockers: report.blockers.map((item) => ({ id: item.id, name: item.name, reason: item.reason })),
            checkedAt: report.checkedAt,
          }),
          {
            status: ready ? 200 : 503,
            headers: { "content-type": "application/json", "cache-control": "no-store" },
          },
        );
      },
    },
  },
});
