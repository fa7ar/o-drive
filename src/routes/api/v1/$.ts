import { createFileRoute } from "@tanstack/react-router";

import { handleApiRequest } from "@/lib/api/v1";

const handler = ({ request }: { request: Request }) => handleApiRequest(request, "/api/v1");

/** Authenticated developer API. Every request carries a Bearer API key. */
export const Route = createFileRoute("/api/v1/$")({
  server: {
    handlers: {
      GET: handler,
      POST: handler,
      PATCH: handler,
      PUT: handler,
      DELETE: handler,
    },
  },
});
