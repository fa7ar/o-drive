#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, statSync } from "node:fs";
import { extname, join } from "node:path";

const MODE = process.argv.includes("--all") ? "all" : "staged";
const TEXT_EXTENSIONS = new Set([
  "",
  ".css",
  ".env",
  ".example",
  ".html",
  ".js",
  ".json",
  ".jsx",
  ".md",
  ".mjs",
  ".sql",
  ".toml",
  ".ts",
  ".tsx",
  ".txt",
  ".yml",
  ".yaml",
]);
const SKIP_DIRS = new Set([".git", ".wrangler", ".output", ".vinxi", "dist", "dist-ssr", "node_modules"]);
const SKIP_FILES = new Set(["scripts/check-secrets.mjs"]);

const SECRET_PATTERNS = [
  {
    name: "Supabase secret key",
    pattern: /(^|[^A-Za-z0-9_])(sb_secret_[A-Za-z0-9._-]{12,})/,
  },
  {
    name: "service-role key material",
    pattern: /(^|[^A-Za-z0-9_])(service_role[A-Za-z0-9._-]{4,})/i,
  },
  {
    name: "JWT-looking key",
    pattern: /(^|[^A-Za-z0-9_])(eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,})/,
  },
];

function runGit(args) {
  const result = spawnSync("git", args, { encoding: "utf8" });
  if (result.error || result.status !== 0) return null;
  return result.stdout;
}

function isTextPath(path) {
  if (SKIP_FILES.has(path)) return false;
  return TEXT_EXTENSIONS.has(extname(path));
}

function trackedFiles() {
  const output = runGit(["ls-files"]);
  if (output == null) return [];
  return output.split("\n").filter(Boolean).filter(isTextPath);
}

function walk(dir = ".", prefix = "") {
  const entries = [];
  for (const name of readdirSafe(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const path = join(dir, name);
    const repoPath = prefix ? `${prefix}/${name}` : name;
    const stat = statSync(path);
    if (stat.isDirectory()) entries.push(...walk(path, repoPath));
    else if (stat.isFile() && isTextPath(repoPath)) entries.push(repoPath);
  }
  return entries;
}

function readdirSafe(dir) {
  try {
    return Array.from(new Set(runGit(["ls-files", dir])?.split("\n").filter(Boolean).map((path) => path.split("/")[0]) ?? []));
  } catch {
    return [];
  }
}

function scanLine(path, lineNumber, text, findings) {
  for (const { name, pattern } of SECRET_PATTERNS) {
    const match = text.match(pattern);
    if (!match) continue;
    findings.push({ path, lineNumber, name });
    return;
  }
}

function scanContent(path, content, findings) {
  content.split(/\r?\n/).forEach((line, index) => scanLine(path, index + 1, line, findings));
}

function scanStaged(findings) {
  const diff = runGit(["diff", "--cached", "--unified=0", "--no-ext-diff", "--", "."]);
  if (diff == null) return false;

  let currentPath = "";
  let newLine = 0;
  for (const line of diff.split("\n")) {
    if (line.startsWith("+++ b/")) {
      currentPath = line.slice(6);
      continue;
    }
    const hunk = line.match(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/);
    if (hunk) {
      newLine = Number(hunk[1]);
      continue;
    }
    if (!currentPath || !isTextPath(currentPath)) continue;
    if (line.startsWith("+") && !line.startsWith("+++")) {
      scanLine(currentPath, newLine, line.slice(1), findings);
      newLine += 1;
    } else if (!line.startsWith("-")) {
      newLine += 1;
    }
  }
  return true;
}

function scanAll(findings) {
  const files = trackedFiles();
  for (const path of files.length ? files : walk()) {
    if (!existsSync(path)) continue;
    scanContent(path, readFileSync(path, "utf8"), findings);
  }
}

const findings = [];
if (MODE === "all") {
  scanAll(findings);
} else if (!scanStaged(findings)) {
  scanAll(findings);
}

if (findings.length > 0) {
  console.error("Secret check failed. Remove these values before committing:");
  for (const finding of findings) {
    console.error(`- ${finding.path}:${finding.lineNumber} (${finding.name})`);
  }
  console.error("Blocked patterns: sb_secret_..., service_role..., and JWT-looking eyJ... tokens.");
  process.exitCode = 1;
} else {
  console.log(`Secret check passed (${MODE}).`);
}
