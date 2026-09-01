import { createFileRoute } from "@tanstack/react-router";

/**
 * Readiness probe: reports dependency checks without leaking configuration.
 * Only presence booleans are exposed — never values.
 */
export const Route = createFileRoute("/api/public/health/ready")({
  server: {
    handlers: {
      GET: () => {
        const checks = {
          encryptionKey: Boolean(process.env["ODRIVE_ENCRYPTION_KEY"]),
          runtime: typeof crypto !== "undefined" && typeof crypto.subtle !== "undefined",
        };
        const ready = checks.runtime;
        return new Response(
          JSON.stringify({
            status: ready ? "ready" : "not_ready",
            checks,
            checkedAt: new Date().toISOString(),
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
