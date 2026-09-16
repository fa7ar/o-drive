# Changelog

All notable changes to ODrive are documented here.

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
