import type { ProviderDescriptor, StorageProvider } from "./types";

/**
 * Dynamic adapter registry. Adding a provider = register() at bootstrap.
 * No core business logic changes required.
 */
const registry = new Map<string, StorageProvider>();

export function registerProvider(provider: StorageProvider): void {
  registry.set(provider.descriptor.id, provider);
}

export function getProvider(id: string): StorageProvider {
  const provider = registry.get(id);
  if (!provider) throw new Error(`No storage adapter registered for "${id}"`);
  return provider;
}

export function tryGetProvider(id: string): StorageProvider | undefined {
  return registry.get(id);
}

export function listProviders(): StorageProvider[] {
  return [...registry.values()];
}

export function listDescriptors(): ProviderDescriptor[] {
  return listProviders().map((p) => p.descriptor);
}
