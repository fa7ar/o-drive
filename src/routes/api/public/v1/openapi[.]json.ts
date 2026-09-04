import { createFileRoute } from "@tanstack/react-router";

import { openApiDocument } from "@/lib/api/openapi";

/** Unauthenticated contract discovery for SDK generators. */
export const Route = createFileRoute("/api/public/v1/openapi.json")({
  server: {
    handlers: {
      GET: () =>
        new Response(JSON.stringify(openApiDocument, null, 2), {
          headers: { "content-type": "application/json", "cache-control": "public, max-age=300" },
        }),
    },
  },
});
