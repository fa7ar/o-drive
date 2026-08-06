import type { ProviderDescriptor, StorageProvider } from "@/core/types";
import { createLiveAdapter } from "./live-adapter";

/** S3-compatible adapter used by both Amazon S3 and Cloudflare R2. */
export function createS3Adapter(
  descriptor: ProviderDescriptor,
  hooks: { fallback: () => StorageProvider },
): StorageProvider {
  return createLiveAdapter(descriptor, hooks);
}
