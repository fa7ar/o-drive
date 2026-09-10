import { useContainer } from "@/core/container";
import { assertUrlAllowed } from "@/core/validation";
import { CURRENT_WORKSPACE } from "@/core/workspace";
import type { WebhookDelivery, WebhookEndpoint, WebhookEventType } from "@/core/types";

/**
 * Outbound webhooks. Payloads are ODrive-shaped (never provider payloads),
 * signed with HMAC-SHA256 over `timestamp.body` and retried with exponential
 * backoff. Consumers de-duplicate on the stable `event_id`.
 */

export const WEBHOOK_EVENTS: WebhookEventType[] = [
  "file.created",
  "file.updated",
  "file.deleted",
  "transfer.completed",
  "transfer.failed",
  "drive.connected",
  "share.accessed",
];

/** 1m, 5m, 15m, 1h, 6h, 24h. */
const BACKOFF_MS = [60_000, 300_000, 900_000, 3_600_000, 21_600_000, 86_400_000];

const secrets = new Map<string, string>();

const randomHex = (bytes: number) =>
  [...crypto.getRandomValues(new Uint8Array(bytes))]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");

export async function signPayload(secret: string, timestamp: number, body: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${timestamp}.${body}`));
  return `t=${timestamp},v1=${[...new Uint8Array(mac)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("")}`;
}

export async function listWebhooks(workspaceId = CURRENT_WORKSPACE): Promise<WebhookEndpoint[]> {
  return useContainer().webhooks.list(workspaceId);
}

export async function createWebhook(input: {
  url: string;
  events: WebhookEventType[];
  workspaceId?: string;
}): Promise<{ endpoint: WebhookEndpoint; secret: string }> {
  assertUrlAllowed(input.url);
  const secret = `whsec_${randomHex(24)}`;
  const endpoint = await useContainer().webhooks.create({
    workspaceId: input.workspaceId ?? CURRENT_WORKSPACE,
    url: input.url,
    events: input.events.length ? input.events : ["file.created"],
    secretMasked: `whsec_••••${secret.slice(-4)}`,
    status: "active",
    failureCount: 0,
    lastDeliveryAt: null,
  });
  secrets.set(endpoint.id, secret);
  return { endpoint, secret };
}

export async function updateWebhook(
  endpointId: string,
  patch: Partial<Pick<WebhookEndpoint, "url" | "events" | "status">>,
): Promise<WebhookEndpoint> {
  if (patch.url) assertUrlAllowed(patch.url);
  return useContainer().webhooks.update(endpointId, patch);
}

export async function deleteWebhook(endpointId: string): Promise<void> {
  secrets.delete(endpointId);
  return useContainer().webhooks.remove(endpointId);
}

export async function listDeliveries(endpointId?: string, limit = 50): Promise<WebhookDelivery[]> {
  return useContainer().webhookDeliveries.list(endpointId ? { endpointId, limit } : { limit });
}

/** Fan-out: one delivery row per subscribed endpoint, then attempt each. */
export async function emitWebhookEvent(
  event: WebhookEventType,
  payload: Record<string, unknown>,
  workspaceId = CURRENT_WORKSPACE,
): Promise<WebhookDelivery[]> {
  const endpoints = (await listWebhooks(workspaceId)).filter(
    (endpoint) => endpoint.status !== "paused" && endpoint.events.includes(event),
  );
  const eventId = `evt_${randomHex(10)}`;
  const created: WebhookDelivery[] = [];
  for (const endpoint of endpoints) {
    const delivery = await useContainer().webhookDeliveries.create({
      endpointId: endpoint.id,
      eventId,
      event,
      payload,
      status: "pending",
      attempt: 0,
      responseStatus: null,
      error: null,
      nextAttemptAt: null,
    });
    created.push(await attemptDelivery(delivery.id));
  }
  return created;
}

/** Performs one delivery attempt and schedules the next one on failure. */
export async function attemptDelivery(deliveryId: string): Promise<WebhookDelivery> {
  const { webhookDeliveries, webhooks } = useContainer();
  const delivery = await webhookDeliveries.get(deliveryId);
  if (!delivery) throw new Error("Delivery not found");
  const endpoint = await webhooks.get(delivery.endpointId);
  if (!endpoint) throw new Error("Webhook not found");

  const attempt = delivery.attempt + 1;
  const timestamp = Math.floor(Date.now() / 1000);
  const body = JSON.stringify({
    event_id: delivery.eventId,
    type: delivery.event,
    created_at: new Date().toISOString(),
    data: delivery.payload,
  });

  try {
    const signature = await signPayload(secrets.get(endpoint.id) ?? endpoint.id, timestamp, body);
    const response = await fetch(endpoint.url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-odrive-event": delivery.event,
        "x-odrive-event-id": delivery.eventId,
        "x-odrive-signature": signature,
      },
      body,
    });
    if (!response.ok) throw new Error(`Endpoint responded ${response.status}`);
    await webhooks.update(endpoint.id, {
      failureCount: 0,
      status: "active",
      lastDeliveryAt: new Date().toISOString(),
    });
    return webhookDeliveries.update(deliveryId, {
      status: "delivered",
      attempt,
      responseStatus: response.status,
      error: null,
      nextAttemptAt: null,
    });
  } catch (error) {
    const failures = endpoint.failureCount + 1;
    await webhooks.update(endpoint.id, {
      failureCount: failures,
      status: failures >= 5 ? "failing" : endpoint.status,
      lastDeliveryAt: new Date().toISOString(),
    });
    const backoff = BACKOFF_MS[Math.min(attempt - 1, BACKOFF_MS.length - 1)]!;
    const exhausted = attempt >= BACKOFF_MS.length;
    return webhookDeliveries.update(deliveryId, {
      status: exhausted ? "failed" : "retrying",
      attempt,
      responseStatus: null,
      error: error instanceof Error ? error.message : "Delivery failed",
      nextAttemptAt: exhausted ? null : new Date(Date.now() + backoff).toISOString(),
    });
  }
}

/** Manual retry from the developer portal. */
export async function retryDelivery(deliveryId: string): Promise<WebhookDelivery> {
  return attemptDelivery(deliveryId);
}
