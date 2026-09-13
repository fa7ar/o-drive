/**
 * Single source of truth for runtime configuration and secrets.
 *
 * Rules enforced here:
 *  - Application code NEVER reads process.env directly for these values.
 *  - Secrets are read lazily (inside handlers), never at module scope.
 *  - Nothing in this module ever returns or logs a secret value; only presence.
 *  - Non-secret configuration may come from Wrangler `vars`; secrets must come
 *    from Cloudflare Worker Secrets.
 */

export type VarKind = "config" | "secret";

export type VarSpec = {
  name: string;
  kind: VarKind;
  required: boolean;
  purpose: string;
  /** Feature that stops working when this is missing. */
  feature: string;
};

/** Non-secret configuration — safe to keep in wrangler vars / version control. */
export const CONFIG_VARS: readonly VarSpec[] = [
  {
    name: "ENVIRONMENT",
    kind: "config",
    required: false,
    purpose: "Deployment environment name (development | staging | production).",
    feature: "diagnostics",
  },
  {
    name: "APP_URL",
    kind: "config",
    required: false,
    purpose: "Public base URL of the deployment, used for absolute links.",
    feature: "emails, share links",
  },
  {
    name: "SUPABASE_URL",
    kind: "config",
    required: true,
    purpose: "Postgres/Auth HTTP endpoint used by the Postgres adapter.",
    feature: "database, auth",
  },
  {
    name: "SUPABASE_PUBLISHABLE_KEY",
    kind: "config",
    required: true,
    purpose: "Publishable (anon) API key — safe for browsers.",
    feature: "database reads, auth",
  },
] as const;

/** Secrets — Cloudflare Worker Secrets only. Never in vars, never in Git. */
export const SECRET_VARS: readonly VarSpec[] = [
  {
    name: "SUPABASE_SERVICE_ROLE_KEY",
    kind: "secret",
    required: true,
    purpose: "Privileged database access for trusted server paths.",
    feature: "provisioning, admin server functions",
  },
  {
    name: "ODRIVE_ENCRYPTION_KEY",
    kind: "secret",
    required: true,
    purpose: "Passphrase for AES-GCM envelope encryption of provider credentials.",
    feature: "credential vault",
  },
  {
    name: "LOVABLE_API_KEY",
    kind: "secret",
    required: false,
    purpose: "Outbound transactional/auth email delivery.",
    feature: "email sending",
  },
  {
    name: "LOVABLE_CRON_SECRET",
    kind: "secret",
    required: false,
    purpose: "Shared secret authenticating scheduled invocations.",
    feature: "scheduled automations",
  },
  {
    name: "LOVABLE_CRON_SECRET_PREVIOUS",
    kind: "secret",
    required: false,
    purpose: "Previous cron secret, kept during rotation.",
    feature: "scheduled automations",
  },
  {
    name: "GOOGLE_CLIENT_ID",
    kind: "secret",
    required: false,
    purpose: "Google Drive OAuth client id.",
    feature: "Google Drive connections",
  },
  {
    name: "GOOGLE_CLIENT_SECRET",
    kind: "secret",
    required: false,
    purpose: "Google Drive OAuth client secret.",
    feature: "Google Drive connections",
  },
  {
    name: "MICROSOFT_CLIENT_ID",
    kind: "secret",
    required: false,
    purpose: "OneDrive OAuth client id.",
    feature: "OneDrive connections",
  },
  {
    name: "MICROSOFT_CLIENT_SECRET",
    kind: "secret",
    required: false,
    purpose: "OneDrive OAuth client secret.",
    feature: "OneDrive connections",
  },
  {
    name: "DROPBOX_CLIENT_ID",
    kind: "secret",
    required: false,
    purpose: "Dropbox OAuth client id.",
    feature: "Dropbox connections",
  },
  {
    name: "DROPBOX_CLIENT_SECRET",
    kind: "secret",
    required: false,
    purpose: "Dropbox OAuth client secret.",
    feature: "Dropbox connections",
  },
] as const;

export const ALL_VARS: readonly VarSpec[] = [...CONFIG_VARS, ...SECRET_VARS];

function raw(name: string): string | undefined {
  const value = typeof process !== "undefined" ? process.env?.[name] : undefined;
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

/** Read a non-secret configuration value. */
export function readConfig(name: string, fallback?: string): string | undefined {
  return raw(name) ?? fallback;
}

/** Read a secret, or undefined when it is not configured. */
export function readSecret(name: string): string | undefined {
  return raw(name);
}

/**
 * Read a secret and fail loudly when absent. The error names the variable and
 * the affected feature but never includes any value.
 */
export function requireSecret(name: string): string {
  const value = raw(name);
  if (!value) {
    const spec = SECRET_VARS.find((item) => item.name === name);
    throw new Error(
      `Missing required secret ${name}${spec ? ` — needed for ${spec.feature}` : ""}. ` +
        `Set it with: wrangler secret put ${name}`,
    );
  }
  return value;
}

export const environmentName = () => readConfig("ENVIRONMENT", "development")!;

export type VarStatus = {
  name: string;
  kind: VarKind;
  required: boolean;
  present: boolean;
  feature: string;
};

/** Presence-only report. Safe to return from a health endpoint. */
export function configStatus(): {
  environment: string;
  ok: boolean;
  missingRequired: string[];
  variables: VarStatus[];
} {
  const variables = ALL_VARS.map((spec) => ({
    name: spec.name,
    kind: spec.kind,
    required: spec.required,
    present: Boolean(raw(spec.name)),
    feature: spec.feature,
  }));
  const missingRequired = variables
    .filter((item) => item.required && !item.present)
    .map((item) => item.name);
  return {
    environment: environmentName(),
    ok: missingRequired.length === 0,
    missingRequired,
    variables,
  };
}

/** Throws when any required variable is missing. Used by deploy-time checks. */
export function assertRequiredConfig(): void {
  const { missingRequired } = configStatus();
  if (missingRequired.length > 0) {
    throw new Error(
      `Configuration incomplete. Missing required variables: ${missingRequired.join(", ")}`,
    );
  }
}
