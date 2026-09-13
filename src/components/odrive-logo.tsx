import { Link } from "@tanstack/react-router";

const LOGO_SRC = "/odrive-logo.png";
import { cn } from "@/lib/utils";

export function OdriveLogo({
  className,
  asLink = true,
  hideTextOnMobile = false,
}: {
  className?: string;
  asLink?: boolean;
  /** Hide the wordmark on very narrow screens so header controls never overflow. */
  hideTextOnMobile?: boolean;
}) {
  const content = (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <img src={LOGO_SRC} alt="ODrive" className="size-7 object-contain" width={28} height={28} />
      <span
        className={cn(
          "font-display text-base font-semibold tracking-tight",
          hideTextOnMobile && "hidden min-[420px]:inline",
        )}
      >
        ODrive
      </span>
    </span>
  );

  if (!asLink) return content;
  return (
    <Link to="/" className="transition-opacity hover:opacity-80">
      {content}
    </Link>
  );
}
