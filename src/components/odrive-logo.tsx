import { Link } from "@tanstack/react-router";

import logo from "@/assets/odrive-logo.png.asset.json";
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
      <img src={logo.url} alt="ODrive" className="size-7 object-contain" width={28} height={28} />
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
