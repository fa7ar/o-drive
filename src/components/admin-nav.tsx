import { Link, useRouterState } from "@tanstack/react-router";

const GROUPS = [
  {
    label: "Overview",
    to: "/admin",
    paths: ["/admin", "/admin/health", "/admin/verification"],
    children: [
      { to: "/admin", label: "Dashboard" },
      { to: "/admin/health", label: "System health" },
      { to: "/admin/verification", label: "Verification" },
    ],
  },
  {
    label: "Storage",
    to: "/admin/providers",
    paths: ["/admin/providers", "/admin/drives", "/admin/connections"],
    children: [
      { to: "/admin/providers", label: "Providers" },
      { to: "/admin/connections", label: "Connections" },
      { to: "/admin/drives", label: "Drives" },
    ],
  },
  {
    label: "Security",
    to: "/admin/credentials",
    paths: ["/admin/credentials", "/admin/shares"],
    children: [
      { to: "/admin/credentials", label: "Credentials" },
      { to: "/admin/shares", label: "Shares" },
    ],
  },
  {
    label: "Automation",
    to: "/admin/automations",
    paths: ["/admin/automations", "/admin/queues"],
    children: [
      { to: "/admin/automations", label: "Automations" },
      { to: "/admin/queues", label: "Jobs" },
    ],
  },
  {
    label: "System",
    to: "/admin/content",
    paths: ["/admin/content", "/admin/modules", "/admin/configurations", "/admin/flags", "/admin/logs"],
    children: [
      { to: "/admin/content", label: "Content" },
      { to: "/admin/modules", label: "Modules" },
      { to: "/admin/configurations", label: "Configurations" },
      { to: "/admin/flags", label: "Feature flags" },
      { to: "/admin/logs", label: "Logs" },
    ],
  },
] as const;

const baseClass =
  "rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground";
const activeClass = "rounded-md px-3 py-1.5 text-sm bg-card text-foreground font-medium shadow-xs";
const secondaryClass =
  "rounded-md px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:text-foreground";
const secondaryActiveClass =
  "rounded-md bg-background px-2.5 py-1 text-xs font-medium text-foreground shadow-xs";

const matchesPath = (pathname: string, path: string) =>
  path === "/admin" ? pathname === "/admin" : pathname === path || pathname.startsWith(`${path}/`);

/** Admin console navigation: five primary areas with contextual sub-sections. */
export function AdminNav() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const activeGroup = GROUPS.find((group) => group.paths.some((path) => matchesPath(pathname, path))) ?? GROUPS[0];

  return (
    <div className="mb-6 space-y-2">
      <nav className="flex flex-wrap gap-1 rounded-lg border border-border bg-surface p-1" aria-label="Admin">
        {GROUPS.map((group) => {
          const active = group === activeGroup;
          return (
            <Link key={group.to} to={group.to} className={active ? activeClass : baseClass}>
              {group.label}
            </Link>
          );
        })}
      </nav>

      {activeGroup.children.length > 1 ? (
        <nav className="flex flex-wrap gap-1 px-1" aria-label={`${activeGroup.label} sections`}>
          {activeGroup.children.map((child) => {
            const active = matchesPath(pathname, child.to);
            return (
              <Link key={child.to} to={child.to} className={active ? secondaryActiveClass : secondaryClass}>
                {child.label}
              </Link>
            );
          })}
        </nav>
      ) : null}
    </div>
  );
}
