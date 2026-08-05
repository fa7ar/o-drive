import { Badge } from "@/components/ui/badge";
import type { ConnectionStatus, TransferStatus } from "@/core/types";
import { cn } from "@/lib/utils";

const CONNECTION_TONE: Record<ConnectionStatus, string> = {
  connected: "border-success/30 bg-success/10 text-success",
  disconnected: "border-border bg-muted text-muted-foreground",
  error: "border-destructive/30 bg-destructive/10 text-destructive",
  pending: "border-warning/30 bg-warning/15 text-warning-foreground",
};

const TRANSFER_TONE: Record<TransferStatus, string> = {
  queued: "border-border bg-muted text-muted-foreground",
  running: "border-primary/30 bg-primary/10 text-primary",
  completed: "border-success/30 bg-success/10 text-success",
  failed: "border-destructive/30 bg-destructive/10 text-destructive",
  cancelled: "border-border bg-muted text-muted-foreground",
};

export function ConnectionStatusBadge({ status }: { status: ConnectionStatus }) {
  return (
    <Badge variant="outline" className={cn("capitalize", CONNECTION_TONE[status])}>
      {status}
    </Badge>
  );
}

export function TransferStatusBadge({ status }: { status: TransferStatus }) {
  return (
    <Badge variant="outline" className={cn("capitalize", TRANSFER_TONE[status])}>
      {status}
    </Badge>
  );
}
