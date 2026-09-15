#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { check, deploymentConfig, options } from "./check-config.mjs";

const require = createRequire(import.meta.url);
try {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const opts = options(args.filter((arg) => arg !== "--dry-run"));
  if (opts.mode !== "local")
    throw new Error("Use --env staging|production and optionally --dry-run.");
  const { environment } = opts;
  const { file, config, vars } = deploymentConfig(environment);
  for (const line of check({ mode: dryRun ? "deployment" : "remote", environment }))
    console.log(line);
  // Build and runtime use the same public project. Worker Secrets stay remote.
  const env = {
    ...process.env,
    ...vars,
    NODE_ENV: "production",
    VITE_SUPABASE_URL: vars.SUPABASE_URL,
    VITE_SUPABASE_PUBLISHABLE_KEY: vars.SUPABASE_PUBLISHABLE_KEY,
    VITE_SUPABASE_PROJECT_ID: vars.SUPABASE_PROJECT_ID ?? "",
  };
  const run = (entry, argv) => {
    const result = spawnSync(process.execPath, [entry, ...argv], { env, stdio: "inherit" });
    if (result.error || result.status !== 0) throw new Error("Build/deploy command failed.");
  };
  run(resolve(dirname(require.resolve("vite/package.json")), "bin/vite.js"), [
    "build",
    "--mode",
    environment,
  ]);
  for (const path of [config.main, config.assets?.directory]) {
    if (typeof path !== "string" || !existsSync(resolve(path))) {
      throw new Error("Build output does not match wrangler.toml main/assets. Deployment stopped.");
    }
  }
  run(resolve(dirname(require.resolve("wrangler/package.json")), "bin/wrangler.js"), [
    "deploy",
    "--config",
    file,
    "--env",
    environment,
    ...(dryRun ? ["--dry-run"] : []),
  ]);
} catch (error) {
  console.error(`Deployment stopped: ${error.message}`);
  process.exitCode = 1;
}
