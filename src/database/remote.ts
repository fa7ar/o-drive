import { repoCall } from "@/lib/repo.functions";

/**
 * Client-side repository proxies. They implement the repository contracts by
 * forwarding each call to the authenticated server bridge — the browser holds
 * no database credentials and never sees another workspace.
 */
export function remoteRepository<T extends object>(name: string): T {
  return new Proxy({} as T, {
    get(_target, property) {
      if (typeof property !== "string") return undefined;
      return async (...args: unknown[]) =>
        repoCall({
          data: {
            repo: name,
            method: property,
            args: JSON.parse(JSON.stringify(args)) as unknown[],
          },
        });
    },
  });
}
