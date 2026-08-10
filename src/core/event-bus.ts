/**
 * Event Bus — decoupled communication between modules. Producers (transfer
 * engine, sync engine, connection manager) publish; consumers (logging,
 * dashboards) subscribe. No module imports another module directly.
 */

export type DomainEvent =
  | { type: "connection.changed"; connectionId: string }
  | { type: "job.updated"; jobId: string }
  | { type: "sync.updated"; syncId: string }
  | { type: "credential.changed"; credentialId: string }
  | { type: "config.changed"; key: string }
  | { type: "log.appended"; category: string }
  | { type: "automation.run"; runId: string };

type Listener = (event: DomainEvent) => void;

const listeners = new Set<Listener>();

export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function publish(event: DomainEvent): void {
  for (const listener of [...listeners]) {
    try {
      listener(event);
    } catch {
      /* a failing subscriber never breaks the producer */
    }
  }
}
