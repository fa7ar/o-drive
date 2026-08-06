import type { StorageProvider } from "@/core/types";
import { getProvider } from "@/core/registry";
import { useContainer } from "@/core/container";

/**
 * Dependency-injection façade. Business logic never instantiates an adapter;
 * it asks the StorageManager, which resolves through the registry and honours
 * the admin enable/disable + maintenance switches.
 */
export const StorageManager = {
  async resolve(providerId: string): Promise<StorageProvider> {
    const { providers, settings } = useContainer();
    const [state, config] = await Promise.all([providers.get(providerId), settings.get()]);
    if (config.maintenanceMode) throw new Error("ODrive is in maintenance mode");
    if (!state.enabled) throw new Error(`Provider "${providerId}" is disabled by an administrator`);
    return getProvider(providerId);
  },

  /** Resolves the adapter that backs a connection. */
  async forConnection(connectionId: string): Promise<StorageProvider> {
    const connection = await useContainer().connections.get(connectionId);
    if (!connection) throw new Error("Connection not found");
    return StorageManager.resolve(connection.providerId);
  },

  async healthCheckAll() {
    const { providers } = useContainer();
    const states = await providers.list();
    return Promise.all(
      states.map(async (state) => {
        try {
          const result = await getProvider(state.providerId).healthCheck();
          return providers.update(state.providerId, {
            health: result.status,
            checkedAt: new Date().toISOString(),
          });
        } catch {
          return providers.update(state.providerId, {
            health: "down",
            checkedAt: new Date().toISOString(),
          });
        }
      }),
    );
  },
};
