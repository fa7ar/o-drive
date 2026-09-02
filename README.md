# ODrive

### Omni Drive — One interface for every storage.

ODrive is a provider-agnostic storage management platform that brings multiple storage providers and multiple accounts into a single, unified interface.

Connect your Google Drive, OneDrive, Telegram, Cloudflare R2, Amazon S3, and other storage services — without making any provider the center of the architecture.

ODrive is designed to be simple for users, modular for developers, and portable across infrastructure.

---

## ✨ Why ODrive?

Storage is fragmented.

You may have:

* Multiple Google Drive accounts
* Multiple OneDrive accounts
* Multiple Telegram accounts
* Cloudflare R2 buckets
* Amazon S3 buckets
* Other storage providers

ODrive provides one consistent interface for managing them.

```text
                    ODrive
                       │
                 ┌─────┴─────┐
                 │   Drives  │
                 └─────┬─────┘
                       │
              ┌────────┼────────┐
              │        │        │
          Google     OneDrive  Telegram
           Drive
              │        │        │
          Account A  Account A Account A
          Account B  Account B Account B
```

The user thinks in terms of **Drives and Files**.

The system handles providers, connections, credentials, adapters, transfers, synchronization, and background jobs underneath.

---

# 🚀 Core Features

## Multi-Provider

Connect different storage providers through one interface.

Planned / supported provider architecture includes:

* Google Drive
* OneDrive
* Telegram
* Cloudflare R2
* Amazon S3
* Additional providers through adapters

Provider availability depends on implementation status.

---

## Multi-Account

ODrive treats multiple accounts from the same provider as first-class connections.

For example:

```text
Google Drive

├── Personal
├── Work
├── Client A
└── Client B
```

The same model applies to other providers.

Multi-account is **not an addon**.

It is part of the core ODrive architecture.

---

# 🏗️ Architecture

ODrive follows a layered, adapter-based architecture.

```text
                    Frontend
                       │
                       ▼
                   API Layer
                       │
                       ▼
                  ODrive Core
                       │
       ┌───────────────┼────────────────┐
       │               │                │
   Repository       Services         Domain
       │
       ▼
   Adapters
       │
 ┌─────┼─────┬─────────┬─────────┐
 │     │     │         │         │
 DB  Storage Auth     Queue    Secrets
 │     │     │         │         │
 ▼     ▼     ▼         ▼         ▼
PG   Drive  Auth      Worker   Secret
D1   R2     Provider   Queue    Store
S3   S3
```

The important principle is:

> **ODrive Core must not depend directly on infrastructure vendors.**

---

# 🔌 Provider Adapter Architecture

Storage providers are implemented through adapters.

Conceptually:

```text
StorageAdapter
      │
      ├── GoogleDriveAdapter
      ├── OneDriveAdapter
      ├── TelegramAdapter
      ├── R2Adapter
      └── S3Adapter
```

The core application communicates with the adapter interface instead of directly calling provider SDKs.

This makes it possible to add or replace providers without rewriting the application core.

---

# 🗄️ Database Agnostic

ODrive is intentionally designed to avoid database vendor lock-in.

The application should communicate through:

```text
Domain
   ↓
Repository
   ↓
Database Adapter
   ↓
Database
```

Possible implementations can include:

* PostgreSQL
* Cloudflare D1
* Other SQL-compatible infrastructure
* Future database adapters

The database vendor should be an infrastructure decision, not a core product dependency.

---

# ☁️ Cloudflare Workers Compatible

ODrive is designed to work with serverless/edge infrastructure such as Cloudflare Workers.

The architecture avoids assumptions about:

* Persistent local filesystem
* Long-running server processes
* In-memory application state
* Node-only runtime APIs

Long-running operations are delegated to queues and background workers.

---

# 🔐 Security

Security is a core architectural concern.

ODrive is designed around:

* Server-side authorization
* Workspace isolation
* Encrypted credentials
* Secure secret management
* OAuth state validation
* Rate limiting
* IDOR protection
* SSRF protection
* Secure file access
* Opaque share tokens
* Share expiration
* Audit logs
* Provider credential isolation

Provider credentials should never be exposed to the frontend.

---

# 📁 Core Domain

The primary domain model is:

```text
Workspace
    │
    ├── Drive
    │     │
    │     └── Connection
    │            │
    │            └── Provider
    │                   │
    │                   └── Adapter
    │
    ├── Transfers
    ├── Sync
    ├── Shares
    └── Automations
```

### Workspace

The security and tenancy boundary.

### Drive

A user-facing storage resource.

### Connection

A specific account/configuration connected to a provider.

### Provider

The external storage service.

### Adapter

The implementation that translates ODrive operations into provider-specific operations.

---

# 🔄 Transfers

ODrive provides a unified transfer layer for moving data between storage providers.

Example:

```text
Google Drive
     │
     ▼
Transfer Engine
     │
     ▼
Cloudflare R2
```

or:

```text
OneDrive
   │
   ▼
Transfer Engine
   │
   ▼
Telegram
```

The Transfer Engine handles:

* Background processing
* Queueing
* Retry
* Idempotency
* Provider rate limits
* Error normalization
* Progress tracking

---

# 🔁 Synchronization

ODrive provides a Sync Engine for keeping storage locations synchronized.

Example:

```text
Google Drive
     ↕
ODrive Sync
     ↕
R2 Backup
```

The sync architecture is provider independent and relies on provider capabilities.

---

# 🔗 Sharing

Files and folders can be exposed through ODrive-controlled share links.

Example:

```text
https://odrive.example/s/xxxxxxxx
```

The public URL does not expose:

* Provider name
* Connection ID
* Provider file ID
* OAuth credentials
* Internal database IDs

Access is resolved through the ODrive Share Gateway.

```text
Share URL
    ↓
Share Validation
    ↓
Permission Check
    ↓
Drive Resolution
    ↓
Connection Resolution
    ↓
Provider Adapter
    ↓
Secure Download / Stream
```

---

# ⚙️ Automation

ODrive includes a lightweight storage-focused automation architecture.

Automation follows:

```text
Trigger
   ↓
Condition
   ↓
Action
   ↓
Queue
   ↓
Existing Transfer / Sync Engine
```

Example:

```text
WHEN
File Created

IF
Extension = PDF

THEN
Copy → Backup Drive
```

Possible automation actions include:

* Copy
* Move
* Sync
* Mirror
* Backup
* Archive
* Delete
* Notify

ODrive intentionally does not attempt to become a generic workflow automation platform.

---

# 🧩 Infrastructure Adapters

The same adapter philosophy applies beyond storage.

Potential abstractions include:

```text
DatabaseAdapter
StorageAdapter
AuthAdapter
QueueAdapter
CacheAdapter
SecretAdapter
SchedulerAdapter
NotificationAdapter
```

This keeps infrastructure replaceable.

---

# 🛠️ Technology Direction

ODrive is designed around a modern web stack and serverless-compatible infrastructure.

Primary direction:

* TypeScript
* Next.js
* Cloudflare Workers
* PostgreSQL-compatible database
* Adapter-based architecture
* Background queues
* REST/API-based backend

The exact infrastructure implementation should remain replaceable.

---

# 🎯 Design Philosophy

### Simple UI

ODrive should not feel like enterprise storage software.

The main application focuses on:

```text
Drives
Files
Transfers
Shares
Automations
Activity
Settings
```

### Provider Agnostic

No provider should dictate the architecture.

### Infrastructure Agnostic

Database, storage, queue, authentication, and other infrastructure should be replaceable.

### Secure by Default

Credentials and internal identifiers should never leak into public interfaces.

### Async by Design

Long-running operations belong in queues.

### Capability Driven

ODrive should only expose functionality that a provider actually supports.

---

# 🖥️ Homepage

ODrive intentionally uses a minimal landing page.

The homepage focuses on three things:

1. What ODrive is
2. Which storage providers it supports
3. How to get started

No unnecessary marketing sections.

---

# 📦 Project Status

ODrive is currently being developed toward its first public release.

Current architectural areas include:

* [x] Core architecture
* [x] Provider abstraction
* [x] Multi-account architecture
* [x] Storage abstraction
* [x] Database abstraction
* [x] Transfer architecture
* [x] Sync architecture
* [x] Sharing architecture
* [x] Automation architecture
* [x] Admin architecture
* [x] Cloudflare Workers compatibility
* [ ] Production hardening
* [ ] Full provider E2E validation
* [ ] Public launch

Provider availability may differ from the architecture roadmap.

---

# 🗺️ Roadmap

Potential future areas:

* Additional storage providers
* Expanded provider capabilities
* Team Workspaces
* Advanced RBAC
* Public API
* SDK
* CLI
* Desktop synchronization
* Mobile applications
* Advanced file versioning
* Webhooks
* Marketplace
* Additional automation capabilities

The roadmap is intentionally secondary to keeping the core platform stable and portable.

---

# 🤝 Contributing

Contributions are welcome.

When adding a new provider, follow the adapter architecture.

A provider implementation should not introduce provider-specific assumptions into the ODrive core.

Prefer:

```text
New Provider
     ↓
Provider Adapter
     ↓
Existing ODrive Core
```

instead of:

```text
New Provider
     ↓
Modify Core Everywhere
```

---

# 📄 License

License information will be added before the public release.

---

# 👤 Creator

ODrive is created by **[Fajar Tri](https://www.linkedin.com/in/fajartri)**.

A T-shaped professional with deep expertise in SEO since 2011, complemented by broad knowledge across digital marketing, vibe coding, PHP native programmer (2008-2011) and related disciplines.

**Fajar Tri**
[LinkedIn](https://www.linkedin.com/in/fajartri)

---

## ODrive

**One Drive. Every Storage.**

Built with a simple idea:

> Your files shouldn't care which storage provider you use.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
