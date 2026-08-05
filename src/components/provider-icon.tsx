import { Boxes, Cloud, Database, HardDrive, Send, type LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

const ICONS: Record<string, LucideIcon> = { HardDrive, Cloud, Send, Boxes, Database };

const ACCENT_CLASS: Record<string, string> = {
  "provider-drive": "bg-provider-drive/12 text-provider-drive",
  "provider-onedrive": "bg-provider-onedrive/12 text-provider-onedrive",
  "provider-telegram": "bg-provider-telegram/12 text-provider-telegram",
  "provider-r2": "bg-provider-r2/12 text-provider-r2",
  "provider-s3": "bg-provider-s3/12 text-provider-s3",
};

export function ProviderIcon({
  icon,
  accent,
  className,
  size = "md",
}: {
  icon: string;
  accent: string;
  className?: string;
  size?: "sm" | "md" | "lg";
}) {
  const Icon = ICONS[icon] ?? Cloud;
  const box = size === "lg" ? "size-12" : size === "sm" ? "size-8" : "size-10";
  const glyph = size === "lg" ? "size-6" : size === "sm" ? "size-4" : "size-5";

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-lg",
        box,
        ACCENT_CLASS[accent] ?? "bg-accent text-accent-foreground",
        className,
      )}
    >
      <Icon className={glyph} strokeWidth={1.8} />
    </span>
  );
}
