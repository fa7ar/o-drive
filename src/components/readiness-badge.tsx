import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { ProviderReadiness } from "@/core/types";

const LABELS: Record<ProviderReadiness, string> = {
  production: "Production",
  beta: "Beta",
  "coming-soon": "Coming soon",
};

const STYLES: Record<ProviderReadiness, string> = {
  production: "border-success/40 bg-success/10 text-success",
  beta: "border-warning/40 text-warning-foreground bg-warning/10",
  "coming-soon": "border-border text-muted-foreground",
};

/** Communicates provider maturity everywhere a provider is offered. */
export function ReadinessBadge({
  readiness,
  className,
}: {
  readiness: ProviderReadiness;
  className?: string;
}) {
  return (
    <Badge variant="outline" className={cn("text-[10px] font-medium", STYLES[readiness], className)}>
      {LABELS[readiness]}
    </Badge>
  );
}

export const isSelectableProvider = (readiness: ProviderReadiness) => readiness !== "coming-soon";
