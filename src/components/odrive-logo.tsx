import { Link } from "@tanstack/react-router";

import { cn } from "@/lib/utils";

export function OdriveLogo({
  className,
  asLink = true,
}: {
  className?: string;
  asLink?: boolean;
}) {
  const content = (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <span className="relative inline-flex size-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
        <span className="font-display text-sm font-bold">O</span>
        <span className="absolute -right-0.5 -bottom-0.5 size-2 rounded-full bg-success ring-2 ring-background" />
      </span>
      <span className="font-display text-base font-semibold tracking-tight">ODrive</span>
    </span>
  );

  if (!asLink) return content;
  return (
    <Link to="/" className="transition-opacity hover:opacity-80">
      {content}
    </Link>
  );
}
