import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/c/blog")({
  component: () => <Outlet />,
});
