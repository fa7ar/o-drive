export type MagicLinkPayload = {
  email: string;
  token: string;
  type: "magiclink";
};

const CURRENT_PUBLIC_ORIGIN = "https://odrive.plab.workers.dev";

function origin(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" ? parsed.origin : null;
  } catch {
    return null;
  }
}

function allowedOrigins(appUrl?: string, additionalOrigins?: string): Set<string> {
  return new Set(
    [
      CURRENT_PUBLIC_ORIGIN,
      origin(appUrl),
      ...(additionalOrigins ?? "").split(",").map(origin),
    ].filter((value): value is string => Boolean(value)),
  );
}

/**
 * Build a first-party verification URL. The OTP is kept in the fragment so it
 * is not sent in HTTP requests, proxy logs, or referrer headers.
 */
export function createAppMagicLink(input: {
  email: string;
  token: string | null;
  callbackUrl?: string | undefined;
  appUrl?: string | undefined;
  additionalOrigins?: string | undefined;
}): string | null {
  if (!input.token) return null;
  const allowed = allowedOrigins(input.appUrl, input.additionalOrigins);
  const callbackOrigin = origin(input.callbackUrl);
  const configuredOrigin = origin(input.appUrl);
  const target =
    (callbackOrigin && allowed.has(callbackOrigin) && callbackOrigin) ||
    (configuredOrigin && allowed.has(configuredOrigin) && configuredOrigin) ||
    CURRENT_PUBLIC_ORIGIN;
  const fragment = new URLSearchParams({
    token: input.token,
    email: input.email,
    type: "magiclink",
  });
  return `${target}/auth#${fragment.toString()}`;
}

export function readAppMagicLink(hash: string): MagicLinkPayload | null {
  const params = new URLSearchParams(hash.replace(/^#/, ""));
  const email = params.get("email")?.trim();
  const token = params.get("token")?.trim();
  if (!email || !token || params.get("type") !== "magiclink") return null;
  return { email, token, type: "magiclink" };
}
