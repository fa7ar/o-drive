import type { FileMetadata, ProviderDescriptor } from "@/core/types";
import { registerProvider } from "@/core/registry";
import { createMockAdapter } from "./mock-adapter";

/**
 * Shared mock file store so the Explorer stays consistent across adapters.
 * A real deployment gives each adapter its own vendor-backed storage.
 */
const fileStore = new Map<string, FileMetadata[]>();
const files = () => fileStore;

export const DESCRIPTORS: ProviderDescriptor[] = [
  {
    id: "google-drive",
    name: "Google Drive",
    tagline: "Docs, Sheets and shared drives",
    icon: "HardDrive",
    accent: "provider-drive",
    authKind: "oauth",
    fields: [
      { key: "name", label: "Connection name", placeholder: "Work Drive" },
      { key: "account", label: "Account email", placeholder: "you@company.com" },
    ],
  },
  {
    id: "onedrive",
    name: "OneDrive",
    tagline: "Microsoft 365 personal and business",
    icon: "Cloud",
    accent: "provider-onedrive",
    authKind: "oauth",
    fields: [
      { key: "name", label: "Connection name", placeholder: "Microsoft 365" },
      { key: "account", label: "Account email", placeholder: "you@company.com" },
    ],
  },
  {
    id: "telegram",
    name: "Telegram",
    tagline: "Unlimited chat-backed object storage",
    icon: "Send",
    accent: "provider-telegram",
    authKind: "bot-token",
    fields: [
      { key: "name", label: "Connection name", placeholder: "Archive bot" },
      { key: "chat", label: "Chat ID", placeholder: "-1001234567890" },
      { key: "token", label: "Bot token", secret: true },
    ],
  },
  {
    id: "r2",
    name: "Cloudflare R2",
    tagline: "Zero egress S3-compatible buckets",
    icon: "Boxes",
    accent: "provider-r2",
    authKind: "api-key",
    fields: [
      { key: "name", label: "Connection name", placeholder: "R2 media" },
      { key: "bucket", label: "Bucket", placeholder: "odrive-media" },
      { key: "secret", label: "Secret access key", secret: true },
    ],
  },
  {
    id: "s3",
    name: "Amazon S3",
    tagline: "Buckets across every AWS region",
    icon: "Database",
    accent: "provider-s3",
    authKind: "api-key",
    fields: [
      { key: "name", label: "Connection name", placeholder: "S3 cold storage" },
      { key: "bucket", label: "Bucket", placeholder: "company-archive" },
      { key: "secret", label: "Secret access key", secret: true },
    ],
  },
];

let bootstrapped = false;

/** Registers every adapter. Called once from the DI container. */
export function registerAdapters(): void {
  if (bootstrapped) return;
  for (const descriptor of DESCRIPTORS) {
    registerProvider(createMockAdapter(descriptor, { files }));
  }
  bootstrapped = true;
}

export { fileStore };
