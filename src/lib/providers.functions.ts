import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/**
 * Thin RPC surface for the live provider adapters. Every credential stays in
 * the server-side vault; the browser only ever sees file metadata.
 */

const callSchema = z.object({
  connectionId: z.string(),
  providerId: z.string(),
  op: z.enum([
    "list",
    "search",
    "upload",
    "download",
    "stream",
    "delete",
    "rename",
    "move",
    "copy",
    "createFolder",
    "quota",
    "metadata",
    "user",
    "health",
    "refresh",
  ]),
  args: z.record(z.string(), z.unknown()).default({}),
});

export const saveProviderCredentials = createServerFn({ method: "POST" })
  .inputValidator((data) =>
    z
      .object({
        connectionId: z.string(),
        providerId: z.string(),
        secrets: z.record(z.string(), z.string()),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const { saveBundle } = await import("./vault.server");
    await saveBundle(data.connectionId, data.secrets);
    return { ok: true };
  });

export const removeProviderCredentials = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({ connectionId: z.string() }).parse(data))
  .handler(async ({ data }) => {
    const { removeBundle } = await import("./vault.server");
    removeBundle(data.connectionId);
    return { ok: true };
  });

export const oauthAuthorizeUrl = createServerFn({ method: "POST" })
  .inputValidator((data) =>
    z.object({ providerId: z.string(), redirectUri: z.string(), state: z.string() }).parse(data),
  )
  .handler(async ({ data }) => {
    const { oauthConfig } = await import("@/adapters/oauth");
    const config = oauthConfig(data.providerId);
    if (!config) return { url: null as string | null, reason: "unsupported" };
    const clientId = process.env[config.clientIdEnv];
    if (!clientId) return { url: null as string | null, reason: "not-configured" };
    const url = new URL(config.authorizeUrl);
    url.searchParams.set("client_id", clientId);
    url.searchParams.set("redirect_uri", data.redirectUri);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", config.scopes.join(" "));
    url.searchParams.set("state", data.state);
    for (const [key, value] of Object.entries(config.extraParams ?? {})) {
      url.searchParams.set(key, value);
    }
    return { url: url.toString(), reason: "ok" };
  });

export const completeOAuth = createServerFn({ method: "POST" })
  .inputValidator((data) =>
    z
      .object({
        providerId: z.string(),
        connectionId: z.string(),
        code: z.string(),
        redirectUri: z.string(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const { oauthConfig } = await import("@/adapters/oauth");
    const { saveBundle } = await import("./vault.server");
    const config = oauthConfig(data.providerId);
    if (!config) throw new Error("Unsupported OAuth provider");
    const clientId = process.env[config.clientIdEnv];
    const clientSecret = process.env[config.clientSecretEnv];
    if (!clientId || !clientSecret) throw new Error("OAuth client is not configured");

    const response = await fetch(config.tokenUrl, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code: data.code,
        grant_type: "authorization_code",
        redirect_uri: data.redirectUri,
      }),
    });
    if (!response.ok) throw new Error(`OAuth exchange failed (${response.status})`);
    const payload = (await response.json()) as {
      access_token: string;
      refresh_token?: string;
      expires_in?: number;
    };
    await saveBundle(data.connectionId, {
      accessToken: payload.access_token,
      refreshToken: payload.refresh_token ?? "",
      expiresAt: String(Date.now() + (payload.expires_in ?? 3600) * 1000),
    });
    return { ok: true };
  });

export const providerCall = createServerFn({ method: "POST" })
  .inputValidator((data) => callSchema.parse(data))
  .handler(async ({ data }) => {
    const { dispatch } = await import("./provider-dispatch.server");
    const result = await dispatch(data);
    return { json: JSON.stringify(result ?? null) };
  });
