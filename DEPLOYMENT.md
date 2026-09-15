# ODrive deployment & configuration

Development can remain in Lovable. Deploy the same repository to Cloudflare
Workers when the target environment is configured. Deployment is a separate step
from pushing to GitHub; a push alone is not proof of a successful deployment.

## Prerequisites

- Node.js 22.18+ and Bun. Run `bun install --frozen-lockfile`.
- Wrangler is pinned in devDependencies; use `bun run` scripts or `bunx wrangler`.
- Authenticate Wrangler in your own Cloudflare account (`bunx wrangler login`).
  CI can use its own scoped `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`.
- Keep credentials out of Git. Do not replace an existing vault encryption key:
  existing provider credentials require the key that encrypted them.

## Configure each target once

Fill `APP_URL`, `SUPABASE_URL`, and `SUPABASE_PUBLISHABLE_KEY` in
`wrangler.toml` under `env.staging.vars` and `env.production.vars`.
Use HTTPS URLs and the publishable/anon key, never the service-role key.
The examples are comments so they cannot overwrite existing dashboard values
with empty strings. The deployment preflight still requires explicit public
values in the selected target to build against the correct database. Named
environment vars do not inherit from the root `[vars]` or from each other.
The root block is for direct Wrangler commands without `--env`; the deployment
scripts always select a named environment explicitly.

The deployment runner injects the selected target's public Supabase URL and key
into the Vite build, so a local development `.env` cannot select the wrong
project. If needed, set `SUPABASE_PROJECT_ID` in that target's vars too.
`APP_URL` must be the URL you intend to serve; configure the corresponding
Cloudflare route/custom domain and provider OAuth redirect URLs separately.

Set required secrets separately for each target:

```bash
bunx wrangler secret put SUPABASE_SERVICE_ROLE_KEY --config wrangler.toml --env staging
bunx wrangler secret put ODRIVE_ENCRYPTION_KEY --config wrangler.toml --env staging
bunx wrangler secret put SUPABASE_SERVICE_ROLE_KEY --config wrangler.toml --env production
bunx wrangler secret put ODRIVE_ENCRYPTION_KEY --config wrangler.toml --env production
```

Use the existing encryption key when deploying against an existing vault.
Generate a new key only for a new vault, or through an explicit re-encryption
migration. Never send secret values in a PR, issue, or chat.

Optional features need their own secrets in the same target:

| Feature               | Secret names                                                     |
| --------------------- | ---------------------------------------------------------------- |
| Email                 | `LOVABLE_API_KEY`                                                |
| Scheduled invocations | `LOVABLE_CRON_SECRET`, optionally `LOVABLE_CRON_SECRET_PREVIOUS` |
| Google Drive          | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`                       |
| OneDrive              | `MICROSOFT_CLIENT_ID`, `MICROSOFT_CLIENT_SECRET`                 |
| Dropbox               | `DROPBOX_CLIENT_ID`, `DROPBOX_CLIENT_SECRET`                     |

The runtime variable registry is `src/config/runtime-env.server.ts`; the checker
imports it instead of maintaining a second required-secret list. Any R2,
Hyperdrive or Queue bindings must be declared in Wrangler when implemented.
`keep_vars = true` preserves dashboard variables, but it is not a substitute for
explicit target configuration. A variable explicitly set in Wrangler can still
overwrite the dashboard value of the same name. Keep the real values aligned;
never deploy empty placeholders. Worker Secrets are preserved across redeploys
when deploying to the same Worker/account/environment.

## Local development versus deployment checks

Copy `.env.example` to ignored `.env.local` and replace the placeholders.
Optional secrets may be left blank. Never put secrets into a `VITE_*` variable.
`.env` and `.env.*` are ignored, except `.env.example`; `.env` is removed from
the tracked tree. Earlier commits still contain the old browser-public values.

For a direct `bun run build` in Lovable or CI, configure `VITE_SUPABASE_URL`
and `VITE_SUPABASE_PUBLISHABLE_KEY` as build-time environment variables (plus
`VITE_SUPABASE_PROJECT_ID` if used). Worker runtime variables alone are not
build-time Vite inputs. The deployment runner supplies the public build values
from the selected Wrangler target automatically. Confirm Lovable's build env is
configured before merging the `.env` removal; generated files must not be
force-added back to Git.

```bash
# Check local runtime values; no Cloudflare access.
node scripts/check-config.mjs --local
# Check browser build values only; server secrets are not needed for this check.
node scripts/check-config.mjs --build
# Validate the selected Wrangler vars without contacting Cloudflare.
node scripts/check-config.mjs --deployment --env staging
# Validate vars and required secret names in the selected remote Worker.
node scripts/check-config.mjs --remote --env staging
bun run test:config
```

Local/build checks load Vite env files (production mode by default, or staging
with `--env staging`), with shell variables taking precedence. Remote checks
never require application secret values in local/CI environment variables.
Wrangler authentication failures, missing remote secrets, malformed responses,
placeholders and missing target vars all fail the gate. Reports never print
secret values. Presence of a remote name does not prove that its value is valid.

## Build and deploy

```bash
# Build using staging public config and validate the Worker bundle without publishing.
bun run deploy:dry-run
# Check staging vars + remote secret names, build and deploy.
bun run deploy:staging
# Perform the same sequence for production.
bun run deploy
```

The runner stops if build output does not match Wrangler's `main` or assets
path. It uses explicit `--config wrangler.toml --env ...` arguments to avoid
selecting a generated or unintended deployment config. Dry-run does not verify
remote secrets or live database access. A successful dry-run is required before
claiming compatibility with the target Cloudflare runtime.

After deploying, check all three endpoints (HTTP failures must fail CI):

```bash
curl --fail --silent --show-error https://YOUR_DOMAIN/api/public/health
curl --fail --silent --show-error https://YOUR_DOMAIN/api/public/health/ready
curl --fail --silent --show-error https://YOUR_DOMAIN/api/public/health/config
```

`health/config` must return `status: "configured"` and the expected environment.
It reports presence only; readiness and functional checks are still required.
Verify login, storage OAuth connection, file listing/upload/download and access
to previously encrypted credentials. Redeploy twice and repeat these checks.
Compare `bunx wrangler secret list --env staging` names between deployments.
Configure email and scheduled automation delivery separately if those features
are enabled; optional-secret presence is not an end-to-end feature test.

## Database portability: current boundary

`src/database/postgres.server.ts` implements `DatabaseAdapter` using the Supabase
HTTP client (`supabaseAdmin.from(...)`). It is not a direct PostgreSQL driver.
Moving to another compatible Supabase project also requires schema/data and auth
migration; changing URL/key alone does not migrate those resources.

Plain PostgreSQL or Cloudflare Hyperdrive needs a separate SQL-backed adapter,
connection/binding configuration and migration verification. Supabase Auth and
other Supabase integrations must also be accounted for. The existing interface
provides a boundary for this work, but generic PostgreSQL portability is not yet
implemented. Keep Hyperdrive references out of domain code.
