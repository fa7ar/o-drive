import { createFileRoute } from "@tanstack/react-router";

import { handleApiRequest } from "@/lib/api/v1";

const handler = ({ request }: { request: Request }) =>
  handleApiRequest(request, "/api/public/v1");

/**
 * Same router as /api/v1, exposed on the public prefix so external callers
 * bypass site auth. The API key check inside the router is the only gate.
 */
export const Route = createFileRoute("/api/public/v1/$")({
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
