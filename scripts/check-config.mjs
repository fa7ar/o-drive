#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { pathToFileURL } from "node:url";
import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";
import TOML from "@iarna/toml";
import { loadEnv } from "vite";
import { ALL_VARS } from "../src/config/runtime-env.server.ts";

const require = createRequire(import.meta.url);
export function options(args) {
  const result = { mode: "local", environment: "production" };
  let modeSet = false;
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (["--local", "--build", "--deployment", "--remote"].includes(arg)) {
      if (modeSet) throw new Error("Choose one check mode.");
      result.mode = arg.slice(2);
      modeSet = true;
    } else if (arg === "--env") {
      result.environment = args[++i];
      if (!["production", "staging"].includes(result.environment)) {
        throw new Error("--env must be production or staging.");
      }
    } else
      throw new Error(
        "Unknown argument. Use --local, --build, --deployment or --remote [--env production|staging].",
      );
  }
  return result;
}

export const configured = (value) =>
  typeof value === "string" &&
  value.trim() !== "" &&
  !/replace[-_ ]?me|your-project-ref|sb_publishable_example|generate-a-long|example\.(com|org)|<[^>]+>/i.test(
    value,
  );

function privilegedKey(value) {
  if (typeof value !== "string") return false;
  if (value.startsWith("sb_secret_")) return true;
  try {
    const payload = JSON.parse(Buffer.from(value.split(".")[1], "base64url").toString());
    return payload.role === "service_role";
  } catch {
    return false;
  }
}

function validUrl(value, local = false) {
  if (!configured(value)) return false;
  try {
    const url = new URL(value);
    return (
      !url.username &&
      !url.password &&
      (url.protocol === "https:" || (local && url.protocol === "http:"))
    );
  } catch {
    return false;
  }
}

export function deploymentConfig(environment, cwd = process.cwd()) {
  const file = resolve(cwd, "wrangler.toml");
  let config;
  try {
    config = TOML.parse(readFileSync(file, "utf8"));
  } catch {
    throw new Error("Cannot read or parse wrangler.toml.");
  }
  const target = config.env?.[environment];
  if (!target) throw new Error("Requested environment is missing from wrangler.toml.");
  // Wrangler vars do not inherit into named environments.
  const vars = target.vars ?? {};
  const errors = [];
  for (const spec of ALL_VARS) {
    if (spec.kind === "secret" && Object.hasOwn(vars, spec.name)) {
      errors.push(`${spec.name}: remove from vars; use Worker Secrets`);
    }
  }
  for (const name of ["APP_URL", "SUPABASE_URL", "SUPABASE_PUBLISHABLE_KEY"]) {
    if (!configured(vars[name]))
      errors.push(`${name}: missing or placeholder in env.${environment}.vars`);
  }
  for (const name of ["APP_URL", "SUPABASE_URL"]) {
    if (configured(vars[name]) && !validUrl(vars[name]))
      errors.push(`${name}: must be an HTTPS URL without credentials`);
  }
  if (vars.ENVIRONMENT !== environment) errors.push("ENVIRONMENT: does not match selected target");
  if (privilegedKey(vars.SUPABASE_PUBLISHABLE_KEY)) {
    errors.push("SUPABASE_PUBLISHABLE_KEY: cannot contain a secret key");
  }
  if (errors.length) throw new Error(errors.join("\n"));
  return { file, config, target, vars };
}

export function secretNames(output) {
  let list;
  try {
    list = JSON.parse(output);
  } catch {
    throw new Error("Wrangler returned invalid secret metadata.");
  }
  if (!Array.isArray(list) || list.some((item) => typeof item?.name !== "string")) {
    throw new Error("Wrangler returned invalid secret metadata.");
  }
  return new Set(list.map((item) => item.name));
}

export function remoteSecrets(environment, file, run = spawnSync) {
  const result = run(
    process.execPath,
    [
      resolve(dirname(require.resolve("wrangler/package.json")), "bin/wrangler.js"),
      "secret",
      "list",
      "--format",
      "json",
      "--config",
      file,
      "--env",
      environment,
    ],
    { encoding: "utf8", timeout: 30000, env: { ...process.env, WRANGLER_SEND_METRICS: "false" } },
  );
  // Never echo CLI stdout/stderr on failure: only validated names reach the report.
  if (result.error || result.status !== 0)
    throw new Error(
      "Cannot check remote secrets. Verify Wrangler authentication, account access and target Worker.",
    );
  return secretNames(result.stdout);
}

export function check({ mode, environment }, cwd = process.cwd(), run = spawnSync) {
  if (mode === "remote" || mode === "deployment") {
    const { file } = deploymentConfig(environment, cwd);
    if (mode === "deployment") return ["Deployment vars: configured (remote secrets not checked)."];
    const names = remoteSecrets(environment, file, run);
    const required = ALL_VARS.filter((spec) => spec.required && spec.kind === "secret");
    const missing = required.filter((spec) => !names.has(spec.name));
    if (missing.length)
      throw new Error(
        `Missing Worker Secrets in ${environment}: ${missing.map((spec) => spec.name).join(", ")}`,
      );
    return [
      `Deployment vars and required secret names: configured for ${environment}.`,
      "Secret values and application connectivity require post-deploy health checks.",
    ];
  }
  const env = { ...loadEnv(environment, cwd, ""), ...process.env };
  const names =
    mode === "build"
      ? ["VITE_SUPABASE_URL", "VITE_SUPABASE_PUBLISHABLE_KEY"]
      : ALL_VARS.filter((spec) => spec.required).map((spec) => spec.name);
  const missing = names.filter((name) => !configured(env[name]));
  if (missing.length)
    throw new Error(`Missing or placeholder ${mode} configuration: ${missing.join(", ")}`);
  const urlName = mode === "build" ? "VITE_SUPABASE_URL" : "SUPABASE_URL";
  if (!validUrl(env[urlName], true)) throw new Error(`${urlName}: invalid URL`);
  const keyName = mode === "build" ? "VITE_SUPABASE_PUBLISHABLE_KEY" : "SUPABASE_PUBLISHABLE_KEY";
  if (privilegedKey(env[keyName])) throw new Error(`${keyName}: cannot contain a secret key`);
  return [`${mode} configuration: present (values never printed).`];
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    for (const line of check(options(process.argv.slice(2)))) console.log(line);
  } catch (error) {
    console.error(`Configuration check failed: ${error.message}`);
    process.exitCode = 1;
  }
}
