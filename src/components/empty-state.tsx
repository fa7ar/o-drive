import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-surface px-6 py-14 text-center",
        className,
      )}
    >
      {icon ? <div className="mb-3 text-muted-foreground">{icon}</div> : null}
      <p className="font-display text-sm font-semibold">{title}</p>
      {description ? (
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>
      ) : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

export function StatusDot({ tone }: { tone: "success" | "muted" | "destructive" | "warning" }) {
  const toneClass = {
    success: "bg-success",
    muted: "bg-muted-foreground/50",
    destructive: "bg-destructive",
    warning: "bg-warning",
  }[tone];
  return <span className={cn("inline-block size-1.5 rounded-full", toneClass)} />;
}
