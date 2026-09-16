import type { FileMetadata, ProviderDescriptor } from "@/core/types";
import { registerProvider } from "@/core/registry";
import { createMockAdapter } from "./mock-adapter";
import { createGoogleDriveAdapter } from "./google-drive-adapter";
import { createS3Adapter } from "./s3-adapter";
import { createLiveAdapter } from "./live-adapter";

/**
 * Simulated vendor-side storage for the mock adapters. Live adapters ignore it
 * entirely and talk to the real provider through server functions.
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
    capability: "live",
    readiness: "production",
    verifiedOperations: ["OAuth", "File operations", "Health", "Credential rotation"],
    scopes: ["https://www.googleapis.com/auth/drive", "openid", "email"],
    fields: [{ key: "name", label: "Connection name", placeholder: "Work Drive" }],
  },
  {
    id: "r2",
    name: "Cloudflare R2",
    tagline: "Zero egress S3-compatible buckets",
    icon: "Boxes",
    accent: "provider-r2",
    authKind: "api-key",
    capability: "live",
    readiness: "production",
    verifiedOperations: ["Upload", "Download", "Streaming", "Health"],
    fields: [
      { key: "name", label: "Connection name", placeholder: "R2 media" },
      { key: "endpoint", label: "S3 endpoint", placeholder: "https://<account>.r2.cloudflarestorage.com" },
      { key: "bucket", label: "Bucket", placeholder: "odrive-media" },
      { key: "accessKeyId", label: "Access key ID" },
      { key: "secretAccessKey", label: "Secret access key", secret: true },
    ],
  },
  {
    id: "s3",
    name: "Amazon S3",
    tagline: "Buckets across every AWS region",
    icon: "Database",
    accent: "provider-s3",
    authKind: "api-key",
    capability: "live",
    readiness: "production",
    verifiedOperations: ["Upload", "Download", "Streaming", "Metadata", "Health"],
    fields: [
      { key: "name", label: "Connection name", placeholder: "S3 cold storage" },
      { key: "region", label: "Region", placeholder: "eu-central-1" },
      { key: "bucket", label: "Bucket", placeholder: "company-archive" },
      { key: "accessKeyId", label: "Access key ID" },
      { key: "secretAccessKey", label: "Secret access key", secret: true },
    ],
  },
  {
    id: "onedrive",
    name: "OneDrive",
    tagline: "Microsoft 365 personal and business",
    icon: "Cloud",
    accent: "provider-onedrive",
    authKind: "oauth",
    capability: "live",
    readiness: "beta",
    verifiedOperations: ["OAuth", "File listing", "Upload", "Download", "Health"],
    scopes: ["Files.ReadWrite.All", "offline_access"],
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
    capability: "live",
    readiness: "beta",
    verifiedOperations: ["Bot API", "File listing", "Upload", "Download", "Health"],
    fields: [
      { key: "name", label: "Connection name", placeholder: "Archive bot" },
      { key: "chat", label: "Chat ID", placeholder: "-1001234567890" },
      { key: "token", label: "Bot token", secret: true },
    ],
  },
];

export const descriptorById = (providerId: string): ProviderDescriptor | undefined =>
  DESCRIPTORS.find((descriptor) => descriptor.id === providerId);

let bootstrapped = false;

/** Registers every adapter. Called once from the DI container. */
export function registerAdapters(): void {
  if (bootstrapped) return;
  for (const descriptor of DESCRIPTORS) {
    if (descriptor.id === "google-drive") {
      registerProvider(createGoogleDriveAdapter(descriptor, { fallback: () => createMockAdapter(descriptor, { files }) }));
      continue;
    }
    if (descriptor.id === "r2" || descriptor.id === "s3") {
      registerProvider(createS3Adapter(descriptor, { fallback: () => createMockAdapter(descriptor, { files }) }));
      continue;
    }
    if (descriptor.id === "onedrive" || descriptor.id === "telegram") {
      registerProvider(createLiveAdapter(descriptor, { fallback: () => createMockAdapter(descriptor, { files }) }));
      continue;
    }
    registerProvider(createMockAdapter(descriptor, { files }));
  }
  bootstrapped = true;
}

export { fileStore };
