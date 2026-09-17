import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/c/changelog")({
  component: () => <Outlet />,
});
