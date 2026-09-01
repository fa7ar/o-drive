import { createFileRoute } from "@tanstack/react-router";

/** Startup check: the runtime booted and can serve requests. */
export const Route = createFileRoute("/api/public/health/live")({
  server: {
    handlers: {
      GET: () =>
        new Response(
          JSON.stringify({ status: "live", checkedAt: new Date().toISOString() }),
          { headers: { "content-type": "application/json", "cache-control": "no-store" } },
        ),
    },
  },
});
