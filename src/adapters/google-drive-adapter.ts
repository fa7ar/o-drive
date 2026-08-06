import type { ProviderDescriptor, StorageProvider } from "@/core/types";
import { createLiveAdapter } from "./live-adapter";

/** Google Drive adapter (OAuth). Falls back to the mock twin in demo mode. */
export function createGoogleDriveAdapter(
  descriptor: ProviderDescriptor,
  hooks: { fallback: () => StorageProvider },
): StorageProvider {
  return createLiveAdapter(descriptor, hooks);
}
