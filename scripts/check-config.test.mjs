import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { check, options, secretNames } from "./check-config.mjs";

const fixture = (staging = "") => {
  const dir = mkdtempSync(join(tmpdir(), "odrive-config-"));
  writeFileSync(
    join(dir, "wrangler.toml"),
    `name = "odrive"
[vars]
ENVIRONMENT = "production"
APP_URL = "https://app.test"
SUPABASE_URL = "https://db.test"
SUPABASE_PUBLISHABLE_KEY = "sb_publishable_test"
[env.staging]
name = "odrive-staging"
[env.staging.vars]
ENVIRONMENT = "staging"
${staging}
`,
  );
  return dir;
};
const vars =
  'APP_URL = "https://staging.test"\nSUPABASE_URL = "https://db.test"\nSUPABASE_PUBLISHABLE_KEY = "sb_publishable_test"';

test("staging never inherits production vars", () => {
  const dir = fixture();
  try {
    assert.throws(() => check({ mode: "deployment", environment: "staging" }, dir), /APP_URL/);
  } finally {
    rmSync(dir, { recursive: true });
  }
});
test("remote check uses selected Worker secret names, not local secret values", () => {
  const dir = fixture(vars);
  try {
    const run = (exe, args) => {
      assert.equal(args.at(-1), "staging");
      assert.ok(args.includes("--config"));
      return {
        status: 0,
        stdout: JSON.stringify([
          { name: "SUPABASE_SERVICE_ROLE_KEY" },
          { name: "ODRIVE_ENCRYPTION_KEY" },
        ]),
      };
    };
    assert.equal(check({ mode: "remote", environment: "staging" }, dir, run).length, 2);
    assert.throws(
      () =>
        check({ mode: "remote", environment: "staging" }, dir, () => ({ status: 0, stdout: "[]" })),
      /Missing Worker Secrets/,
    );
  } finally {
    rmSync(dir, { recursive: true });
  }
});
test("remote errors do not reveal CLI output", () => {
  const dir = fixture(vars);
  try {
    assert.throws(
      () =>
        check({ mode: "remote", environment: "staging" }, dir, () => ({
          status: 1,
          stdout: "sensitive-output",
          stderr: "sensitive-output",
        })),
      (error) => !error.message.includes("sensitive-output") && /Cannot check/.test(error.message),
    );
  } finally {
    rmSync(dir, { recursive: true });
  }
});
test("secrets in vars and placeholders are rejected", () => {
  for (const value of [
    vars + '\nODRIVE_ENCRYPTION_KEY = "never-print-this"',
    vars.replace("sb_publishable_test", "sb_publishable_example"),
  ]) {
    const dir = fixture(value);
    try {
      assert.throws(
        () => check({ mode: "deployment", environment: "staging" }, dir),
        (error) => !error.message.includes("never-print-this"),
      );
    } finally {
      rmSync(dir, { recursive: true });
    }
  }
});
test("invalid CLI options and secret metadata fail closed", () => {
  assert.throws(() => options(["--env", "stagng"]));
  assert.throws(() => options(["--remote", "--build"]));
  assert.throws(() => secretNames("not-json"));
  assert.throws(() => secretNames("{}"));
  assert.deepEqual(options(["--remote", "--env", "staging"]), {
    mode: "remote",
    environment: "staging",
  });
});

test("malformed TOML does not echo sensitive source lines", () => {
  const dir = fixture();
  try {
    writeFileSync(join(dir, "wrangler.toml"), 'secret = "never-print-this');
    assert.throws(
      () => check({ mode: "deployment", environment: "staging" }, dir),
      (error) => error.message === "Cannot read or parse wrangler.toml.",
    );
  } finally {
    rmSync(dir, { recursive: true });
  }
});
test("a legacy service-role JWT cannot be used as a public key", () => {
  const jwt =
    "header." +
    Buffer.from(JSON.stringify({ role: "service_role" })).toString("base64url") +
    ".sig";
  const dir = fixture(vars.replace("sb_publishable_test", jwt));
  try {
    assert.throws(
      () => check({ mode: "deployment", environment: "staging" }, dir),
      /cannot contain a secret key/,
    );
  } finally {
    rmSync(dir, { recursive: true });
  }
});
test("browser build check needs no application secrets", () => {
  const dir = fixture();
  try {
    writeFileSync(
      join(dir, ".env.local"),
      "VITE_SUPABASE_URL=https://db.test\nVITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_test\n",
    );
    assert.equal(check({ mode: "build", environment: "staging" }, dir).length, 1);
  } finally {
    rmSync(dir, { recursive: true });
  }
});
