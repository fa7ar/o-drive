import { createFileRoute, redirect } from "@tanstack/react-router";

/**
 * The workspace no longer has a separate overview page — Explorer is the home
 * of the product. Kept as a permanent redirect so old links keep working.
 */
export const Route = createFileRoute("/_authenticated/dashboard")({
  beforeLoad: () => {
    throw redirect({ to: "/explorer", replace: true });
  },
});
