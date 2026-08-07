import { useContainer } from "./container";
import { publish } from "./event-bus";
import { log } from "./logs";
import type { ConfigEntry, ConfigSection } from "./types";

/** Configuration Manager — searchable, sectioned, environment-aware. */

export const CONFIG_SECTIONS: Array<{ id: ConfigSection; label: string }> = [
  { id: "general", label: "General" },
  { id: "providers", label: "Providers" },
  { id: "security", label: "Security" },
  { id: "storage", label: "Storage" },
  { id: "transfers", label: "Transfers" },
  { id: "queue", label: "Queue" },
  { id: "search", label: "Search" },
  { id: "logging", label: "Logging" },
];

export async function listConfig(): Promise<ConfigEntry[]> {
  return useContainer().config.list();
}

export async function setConfig(key: string, value: ConfigEntry["value"]): Promise<ConfigEntry> {
  const entry = await useContainer().config.set(key, value);
  await log({ category: "system", severity: "info", message: `Configuration ${key} updated` });
  publish({ type: "config.changed", key });
  return entry;
}

export async function resetConfig(key: string): Promise<ConfigEntry> {
  const entry = await useContainer().config.reset(key);
  await log({ category: "system", severity: "info", message: `Configuration ${key} reset to default` });
  publish({ type: "config.changed", key });
  return entry;
}

export const isOverridden = (entry: ConfigEntry): boolean => entry.value !== entry.defaultValue;
