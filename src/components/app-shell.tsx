import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  ArrowLeftRight,
  Clock,
  Code2,
  Files,
  FolderTree,
  HardDrive,
  History,
  Link2,
  LogOut,
  Plug,
  Search,
  Settings as SettingsIcon,
  Shield,
  Home as HomeIcon,
  Zap,
} from "lucide-react";
import { useState, type ReactNode } from "react";

import { OdriveLogo } from "@/components/odrive-logo";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

type SectionKey = "home" | "files" | "activity" | "settings";

const SECTIONS: Array<{
  key: SectionKey;
  label: string;
  icon: typeof Files;
  to: string;
  children: Array<{ to: string; label: string; icon: typeof Files }>;
}> = [
  {
    key: "home",
    label: "Home",
    icon: HomeIcon,
    to: "/home",
    children: [
      { to: "/home", label: "Dashboard", icon: HomeIcon },
    ],
  },
  {
    key: "files",
    label: "Files",
    icon: Files,
    to: "/explorer",
    children: [
      { to: "/explorer", label: "Explorer", icon: FolderTree },
      { to: "/drives", label: "Drives", icon: HardDrive },
      { to: "/connections", label: "Connections", icon: Plug },
    ],
  },
  {
    key: "activity",
    label: "Activity",
    icon: Clock,
    to: "/transfers",
    children: [
      { to: "/transfers", label: "Transfers", icon: ArrowLeftRight },
      { to: "/shares", label: "Shares", icon: Link2 },
      { to: "/automations", label: "Automations", icon: Zap },
      { to: "/activity", label: "Activity", icon: History },
    ],
  },
  {
    key: "settings",
    label: "Settings",
    icon: SettingsIcon,
    to: "/settings",
    children: [
      { to: "/settings", label: "General", icon: SettingsIcon },
      { to: "/settings/security", label: "Security", icon: Shield },
      { to: "/developer", label: "Developer", icon: Code2 },
    ],
  },
];

function sectionForPath(pathname: string): SectionKey {
  if (pathname.startsWith("/home")) return "home";
  if (
    pathname.startsWith("/transfers") ||
    pathname.startsWith("/shares") ||
    pathname.startsWith("/automations") ||
    pathname.startsWith("/activity")
  )
    return "activity";
  if (pathname.startsWith("/settings") || pathname.startsWith("/developer")) return "settings";
  return "files"; // explorer, drives, connections, files detail, default
}

export function AppShell({
  title,
  description,
  actions,
  children,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const [query, setQuery] = useState("");

  const displayName = user?.displayName || "ODrive User";
  const initials = (user?.displayName ?? "od").slice(0, 2).toUpperCase();
  const activeSection = SECTIONS.find((section) => section.key === sectionForPath(pathname))!;
  const isAdmin = pathname.startsWith("/admin");

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b border-border bg-card/85 backdrop-blur">
        <div className="flex h-14 items-center gap-2 px-3 sm:gap-4 sm:px-4 lg:px-6">
          <OdriveLogo hideTextOnMobile />

          {/* Three top-level tabs — the entire product lives under these. */}
          <nav className="ml-2 hidden items-center gap-1 md:flex" aria-label="Primary">
            {SECTIONS.map((section) => {
              const active = section.key === activeSection.key && !isAdmin;
              return (
                <Link
                  key={section.key}
                  to={section.to}
                  className={cn(
                    "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                    active
                      ? "bg-accent text-accent-foreground"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {section.label}
                </Link>
              );
            })}
          </nav>

          <form
            className="relative ml-auto w-full min-w-0 flex-1 sm:max-w-sm sm:flex-none"
            onSubmit={(event) => {
              event.preventDefault();
              navigate({ to: "/explorer", search: { q: query || undefined } });
            }}
          >
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search across every drive"
              className="h-10 bg-surface pl-9 sm:h-9"
              aria-label="Search files"
              enterKeyHint="search"
            />
          </form>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-10 shrink-0 gap-2 px-2 sm:h-9">
                <span className="inline-flex size-7 items-center justify-center rounded-full bg-accent text-xs font-semibold text-accent-foreground">
                  {initials}
                </span>
                <span className="hidden text-sm sm:inline">{displayName}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel className="truncate text-xs font-normal text-muted-foreground">
                {displayName}
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link to="/settings">Settings</Link>
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={async () => {
                  await signOut();
                  navigate({ to: "/auth", replace: true });
                }}
              >
                <LogOut className="size-4" />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <div className="flex">
        <aside className="sticky top-14 hidden h-[calc(100vh-3.5rem)] w-52 shrink-0 border-r border-border bg-sidebar px-3 py-5 lg:block">
          <p className="px-3 font-mono text-[11px] tracking-wide text-muted-foreground uppercase">
            {activeSection.label}
          </p>
          <nav className="mt-2 space-y-1">
            {activeSection.children.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                activeProps={{
                  className:
                    "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium bg-sidebar-accent text-sidebar-accent-foreground",
                }}
                activeOptions={{ exact: item.to === "/settings" || item.to === "/activity" }}
              >
                <item.icon className="size-4" strokeWidth={1.8} />
                {item.label}
              </Link>
            ))}
          </nav>
        </aside>

        <main className="min-w-0 flex-1 px-4 py-6 lg:px-8">
          <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h1 className="text-2xl font-semibold">{title}</h1>
              {description ? (
                <p className="mt-1 text-sm text-muted-foreground">{description}</p>
              ) : null}
            </div>
            {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
          </div>

          {/* Contextual sub-navigation on mobile (segmented, scrollable). */}
          <nav className="mb-5 flex gap-1 overflow-x-auto rounded-lg border border-border bg-card p-1 lg:hidden">
            {activeSection.children.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className="shrink-0 rounded-md px-3 py-1.5 text-sm text-muted-foreground"
                activeProps={{
                  className: "shrink-0 rounded-md px-3 py-1.5 text-sm bg-accent font-medium",
                }}
                activeOptions={{ exact: item.to === "/settings" || item.to === "/activity" }}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          {children}

          <nav className="mt-10 flex flex-wrap gap-1 border-t border-border pt-4 md:hidden">
            {SECTIONS.map((section) => (
              <Link
                key={section.key}
                to={section.to}
                className="rounded-md px-3 py-2 text-sm text-muted-foreground"
                activeProps={{ className: "rounded-md px-3 py-2 text-sm text-primary font-medium" }}
              >
                {section.label}
              </Link>
            ))}
          </nav>
        </main>
      </div>
    </div>
  );
}
