import { createFileRoute } from "@tanstack/react-router";

const started = Date.now();

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });

/** Liveness probe. No secrets, no dependencies, always cheap. */
export const Route = createFileRoute("/api/public/health")({
  server: {
    handlers: {
      GET: () =>
        json({
          status: "ok",
          service: "odrive",
          uptimeSeconds: Math.round((Date.now() - started) / 1000),
          checkedAt: new Date().toISOString(),
        }),
    },
  },
});
