# Changelog

All notable changes to ODrive are documented here.

## 0.4.2 - 2026-09-22

### Added

- Added Backup & Sync Policies with source, destination, mode, schedule, retention, conflict handling, pause/resume and manual run state.
- Added Storage Pools as routing abstractions above existing connections instead of new storage providers.
- Added routing strategies for Round Robin, Weighted Round Robin, Priority/Failover, Least Used and Most Available Space.
- Added smart routing checks for provider health, connection status, declared capability and destination availability.
- Added `/backup-sync` with Policies, Runs and Storage Pools views.
- Added Backup & Sync readiness checks for scheduler, backup engine, sync policy, routing engine, storage pools, round robin persistence, weighted routing, health-aware routing, failover and cross-provider transfer.

### Changed

- Registered backup/sync operations in the Universal Action Registry and routed policy runs through `transfer.create`.
- Updated the member area Activity navigation to include Backup & Sync next to Transfers and Automations.

### Reliability

- Persisted routing cursor and nonce with the storage pool state so round robin does not rely on Worker memory.
- Kept routing idempotent by using deterministic ActionService idempotency keys for policy runs.
- Failures now record run history and mark affected policies as error instead of silently retrying forever.

## 0.4.1 - 2026-09-17

### Added

- Added unified content management for pages, blog, docs, changelog and legal content.
- Added the `/admin/content` Markdown editor with SEO, OpenGraph, navigation visibility and preview controls.
- Added dynamic public content routes for `/p/:slug`, `/c/blog/:slug`, `/c/docs/:slug`, `/c/changelogs/:slug` and `/legal/:slug`.
- Added archive pages for Blog, Docs and Changelogs.
- Added reusable public footer navigation with grouped Content and Legal menus.
- Added collapsible member-area sidebar and an Admin shortcut in the user menu.
- Added the Production Verification Center at `/admin/verification` with infrastructure, provider and core feature readiness groups.
- Added a reusable ReadinessService that feeds Admin Verification, provider badges, the admin dashboard and the readiness health endpoint.
- Added the Universal Action Layer with a central ActionService, stable action IDs, permission checks, provider capability checks, idempotency support and standard action results.
- Added an Action Registry view inside Admin Verification so operators can inspect action IDs, execution mode, required permissions and required capabilities.
- Added the secure Module Runtime foundation with manifest validation, ZIP package safety checks, lifecycle operations, permission grants, entitlements and ActionService-only execution.
- Added `/admin/modules` with Installed, Available and Upload Module views plus an Advanced Backup example package for install, enable, permission, ActionService, disable and uninstall verification.
- Added module readiness checks for Module Runtime, Module Registry, Package Storage and Entitlement Service in the Production Verification Center.

### Changed

- Migrated existing legal pages to the unified content system while preserving existing `/legal/*` URLs.
- Simplified admin navigation into five primary areas with contextual sub-sections.
- Updated the homepage footer to use content-driven navigation.
- Removed duplicate Sign in/Open workspace button from the homepage topnav.
- Refined the content editor layout into a single Markdown/Preview switch with a compact inline formatting toolbar.
- Compact content editor mode tabs to `ME` and `Pre` with hover tooltips while keeping format actions on the same line.
- Simplified the content editor format toolbar into grouped dropdown actions for paragraph, format, media and other inserts.
- Moved Blog, Changelogs and Docs into the footer Content dropdown instead of showing Docs and Changelogs as standalone footer links.
- Moved provider public status calculation behind unified readiness checks instead of relying only on static descriptors.
- Routed core file, folder, upload, transfer and Public API operations through the shared ActionService instead of direct per-consumer implementations.
- Kept extension points declarative so modules can register navigation, dashboard widgets, settings panels, file actions, context menus and automation actions without mutating Core UI directly.

### Fixed

- Fixed spacing between KPI cards and content sections on Security > Shares.
- Fixed inconsistent public footer branding on content and legal pages.
- Fixed public content hydration on blog, docs and changelog pages by rendering deterministic published dates.
- Fixed plural Changelogs URLs so `/c/changelogs` and `/c/changelogs/:slug` resolve directly.
- Fixed public blog, docs and changelog single routes so slug pages render single content instead of the archive view.
- Updated `/api/public/health/ready` to report deployment readiness and blockers from the unified readiness service without exposing secret values.
- Standardized unsupported provider operations such as Telegram move/copy/delete/rename/create-folder through `CAPABILITY_UNSUPPORTED` action responses.

## 0.4.0 - 2026-09-16

### Added

- Added beta live OneDrive provider operations through Microsoft Graph: list, search, create folder, upload, download, rename, move, copy, metadata, quota, user, and health.
- Added beta live Telegram provider operations through the Bot API: document upload, recent document listing, search, download, user, quota placeholder, and health.
- Added admin provider readiness badges and verified operation chips so /admin/providers reflects production, beta, and live adapter state.
- Added Cloudflare deployment documentation, runtime config checks, and public/secret environment separation guidance.

### Changed

- Promoted OneDrive and Telegram from coming soon mock adapters to beta live adapters with mock fallback when credentials are not configured.
- Updated the homepage provider status copy so the public page no longer labels OneDrive and Telegram as coming soon.
- Updated README project status: production hardening is complete; full provider E2E validation and public launch remain open.

### Security

- Added automated secret scanning for local commits and GitHub Actions.
- Blocked commits containing secret-like Supabase names, service role references, and JWT-shaped token values.
- Kept real runtime secrets out of committed configuration files.

### Validation Notes

- Google Drive, Cloudflare R2, and Amazon S3 remain production providers.
- OneDrive and Telegram are beta until their complete provider flows are validated against real accounts in staging and production.
