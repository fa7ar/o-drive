import { Link } from "@tanstack/react-router";

/** Admin console sub-navigation. Dense, desktop-first, no chrome. */
const ITEMS = [
  { to: "/admin", label: "Dashboard" },
  { to: "/admin/providers", label: "Providers" },
  { to: "/admin/credentials", label: "Credentials" },
  { to: "/admin/connections", label: "Connections" },
  { to: "/admin/queues", label: "Queues" },
  { to: "/admin/logs", label: "Logs" },
  { to: "/admin/configurations", label: "Configurations" },
  { to: "/admin/health", label: "System health" },
] as const;

export function AdminNav() {
  return (
    <nav className="mb-6 flex flex-wrap gap-1 rounded-lg border border-border bg-surface p-1">
      {ITEMS.map((item) => (
        <Link
          key={item.to}
          to={item.to}
          activeOptions={{ exact: item.to === "/admin" }}
          className="rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
          activeProps={{
            className: "rounded-md px-3 py-1.5 text-sm bg-card text-foreground font-medium shadow-xs",
          }}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
