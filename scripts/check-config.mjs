#!/usr/bin/env node
/**
 * Pre-deploy configuration gate.
 *
 * Prints presence only — never a value. Exits non-zero when a required
 * variable is missing so a deployment fails clearly instead of silently
 * booting a Worker without its database or encryption key.
 *
 * Usage:  node scripts/check-config.mjs
 *         node scripts/check-config.mjs --remote   (list configured secret names)
 */

const REQUIRED = [
  ["SUPABASE_URL", "config", "database, auth"],
  ["SUPABASE_PUBLISHABLE_KEY", "config", "database reads, auth"],
  ["SUPABASE_SERVICE_ROLE_KEY", "secret", "provisioning, admin server functions"],
  ["ODRIVE_ENCRYPTION_KEY", "secret", "credential vault"],
];

const OPTIONAL = [
  ["ENVIRONMENT", "config", "diagnostics"],
  ["APP_URL", "config", "emails, share links"],
  ["LOVABLE_API_KEY", "secret", "email sending"],
  ["LOVABLE_CRON_SECRET", "secret", "scheduled automations"],
  ["GOOGLE_CLIENT_ID", "secret", "Google Drive connections"],
  ["GOOGLE_CLIENT_SECRET", "secret", "Google Drive connections"],
  ["MICROSOFT_CLIENT_ID", "secret", "OneDrive connections"],
  ["MICROSOFT_CLIENT_SECRET", "secret", "OneDrive connections"],
  ["DROPBOX_CLIENT_ID", "secret", "Dropbox connections"],
  ["DROPBOX_CLIENT_SECRET", "secret", "Dropbox connections"],
];

const present = (name) => Boolean(process.env[name]?.trim());
const mark = (ok) => (ok ? "present" : "MISSING");

console.log(`ODrive configuration check — ${process.env.ENVIRONMENT ?? "development"}\n`);

console.log("Required:");
const missing = [];
for (const [name, kind, feature] of REQUIRED) {
  const ok = present(name);
  if (!ok) missing.push(name);
  console.log(`  ${name.padEnd(28)} ${kind.padEnd(7)} ${mark(ok)}  (${feature})`);
}

console.log("\nOptional:");
for (const [name, kind, feature] of OPTIONAL) {
  console.log(`  ${name.padEnd(28)} ${kind.padEnd(7)} ${mark(present(name))}  (${feature})`);
}

if (missing.length > 0) {
  console.error(
    `\nFAILED — missing required configuration: ${missing.join(", ")}\n` +
      `Set secrets with: wrangler secret put <NAME>\n` +
      `Set non-secret vars in wrangler.toml [vars].`,
  );
  process.exit(1);
}

console.log("\nOK — all required configuration is present.");
