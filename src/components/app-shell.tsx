import { Link, useNavigate } from "@tanstack/react-router";
import {
  ArrowLeftRight,
  FolderTree,
  HardDrive,
  LayoutDashboard,
  Link2,
  LogOut,
  Plug,
  Search,
  Settings as SettingsIcon,
  ShieldCheck,

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

const NAV = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/drives", label: "Drives", icon: HardDrive },
  { to: "/connections", label: "Connections", icon: Plug },
  { to: "/explorer", label: "Explorer", icon: FolderTree },
  { to: "/transfers", label: "Transfers", icon: ArrowLeftRight },
  { to: "/shares", label: "Shares", icon: Link2 },
  { to: "/settings", label: "Settings", icon: SettingsIcon },
  { to: "/admin", label: "Admin", icon: ShieldCheck },
] as const;

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
  const [query, setQuery] = useState("");

  const initials = (user?.displayName ?? "od").slice(0, 2).toUpperCase();

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b border-border bg-card/85 backdrop-blur">
        <div className="flex h-14 items-center gap-4 px-4 lg:px-6">
          <OdriveLogo />
          <form
            className="relative ml-auto w-full max-w-sm"
            onSubmit={(event) => {
              event.preventDefault();
              navigate({ to: "/explorer", search: { q: query || undefined } });
            }}
          >
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search across every connection"
              className="h-9 bg-surface pl-9"
              aria-label="Search files"
            />
          </form>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-9 gap-2 px-2">
                <span className="inline-flex size-7 items-center justify-center rounded-full bg-accent text-xs font-semibold text-accent-foreground">
                  {initials}
                </span>
                <span className="hidden text-sm sm:inline">{user?.email}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel className="truncate text-xs font-normal text-muted-foreground">
                {user?.email}
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
        <aside className="sticky top-14 hidden h-[calc(100vh-3.5rem)] w-56 shrink-0 border-r border-border bg-sidebar px-3 py-5 lg:block">
          <nav className="space-y-1">
            {NAV.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                activeProps={{
                  className:
                    "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium bg-sidebar-accent text-sidebar-accent-foreground",
                }}
              >
                <item.icon className="size-4" strokeWidth={1.8} />
                {item.label}
              </Link>
            ))}
          </nav>
          <p className="mt-8 px-3 font-mono text-[11px] leading-relaxed text-muted-foreground">
            adapters registered: 5
            <br />
            mode: mock repositories
          </p>
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
          {children}

          <nav className="mt-10 flex flex-wrap gap-1 border-t border-border pt-4 lg:hidden">
            {NAV.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className="rounded-md px-3 py-2 text-sm text-muted-foreground"
                activeProps={{ className: "rounded-md px-3 py-2 text-sm text-primary font-medium" }}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </main>
      </div>
    </div>
  );
}
