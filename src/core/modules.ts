import { executeAction, type ActionId, type ActionResult } from "@/core/actions";
import { log } from "@/core/logs";
import { CURRENT_WORKSPACE } from "@/core/workspace";

export type ModuleEdition = "free" | "pro" | "enterprise" | "private";
export type ModuleKind = "official" | "verified" | "community" | "private";
export type ModuleStatus = "available" | "installed" | "enabled" | "disabled" | "blocked";
export type ModuleOperation = "install" | "enable" | "disable" | "update" | "uninstall";

export interface ModuleManifest {
  id: string;
  name: string;
  description: string;
  version: string;
  odriveVersion: string;
  edition: ModuleEdition;
  author: string;
  kind: ModuleKind;
  dependencies?: string[];
  extensionPoints?: ModuleExtension[];
}

export interface ModulePermission {
  id: string;
  label: string;
  actionIds: ActionId[];
}

export interface ModuleExtension {
  point: "navigation" | "dashboard.widget" | "settings.panel" | "file.action" | "context.menu" | "automation.action";
  label: string;
  target?: string;
}

export interface ModulePackageEntry {
  path: string;
  sizeBytes: number;
  checksum?: string;
}

export interface ModulePackageInput {
  fileName: string;
  sizeBytes: number;
  checksum?: string;
  manifest: ModuleManifest;
  permissions: ModulePermission[];
  entries: ModulePackageEntry[];
}

export interface InstalledModule {
  manifest: ModuleManifest;
  permissions: ModulePermission[];
  grantedPermissions: string[];
  status: ModuleStatus;
  installedAt: string;
  updatedAt: string;
  enabledAt?: string;
  packageChecksum: string;
  updateAvailable: boolean;
  entitlement: ModuleEntitlement;
  migrationState: "none" | "pending" | "applied" | "failed";
}

export interface ModuleEntitlement {
  moduleId: string;
  workspaceId: string;
  edition: ModuleEdition;
  entitled: boolean;
  reason: string;
}

export interface ModuleValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export interface ModuleRegistrySnapshot {
  available: ModuleManifest[];
  installed: InstalledModule[];
  runtime: {
    healthy: boolean;
    allowedActions: ActionId[];
    extensionPoints: ModuleExtension[];
  };
}

const ODRIVE_VERSION = "1.0.0";
const MAX_PACKAGE_BYTES = 10 * 1024 * 1024;
const MAX_FILE_COUNT = 200;
const MODULE_ID = /^[a-z0-9][a-z0-9-]{2,62}$/;
const SEMVER = /^\d+\.\d+\.\d+$/;
const installed = new Map<string, InstalledModule>();
const entitlementOverrides = new Map<string, boolean>();

export const MODULE_REGISTRY_TABLES = [
  "modules",
  "module_versions",
  "module_installations",
  "module_permissions",
  "module_configurations",
  "module_entitlements",
  "module_migrations",
] as const;

export const MODULE_PERMISSION_CATALOG: ModulePermission[] = [
  { id: "files.read", label: "Read files", actionIds: ["file.download"] },
  { id: "files.write", label: "Create, rename, move, copy and delete files", actionIds: ["file.upload", "file.rename", "file.move", "file.copy", "file.delete", "file.create_folder"] },
  { id: "transfers.create", label: "Create transfers", actionIds: ["transfer.create"] },
  { id: "transfers.manage", label: "Cancel or retry transfers", actionIds: ["transfer.cancel", "transfer.retry"] },
  { id: "backup.run", label: "Run backup and sync policies", actionIds: ["backup.policy.run", "backup.pool.route"] },
  { id: "shares.create", label: "Create and manage share links", actionIds: ["share.create", "share.update", "share.revoke"] },
  { id: "automations.run", label: "Run automations", actionIds: ["automation.run"] },
  { id: "activity.read", label: "Read activity metadata", actionIds: [] },
];

export const EXAMPLE_MODULE_PACKAGE: ModulePackageInput = {
  fileName: "advanced-backup.zip",
  sizeBytes: 186_240,
  checksum: "sha256:example-advanced-backup",
  manifest: {
    id: "advanced-backup",
    name: "Advanced Backup",
    description: "Verifies the secure module lifecycle with a declarative backup action.",
    version: "1.0.0",
    odriveVersion: ">=1.0.0",
    edition: "free",
    author: "ODrive Core",
    kind: "official",
    dependencies: [],
    extensionPoints: [
      { point: "navigation", label: "Backups", target: "/backups" },
      { point: "file.action", label: "Add to Backup" },
    ],
  },
  permissions: [
    { id: "files.read", label: "Read files", actionIds: ["file.download"] },
    { id: "transfers.create", label: "Create transfers", actionIds: ["transfer.create"] },
  ],
  entries: [
    { path: "manifest.json", sizeBytes: 540 },
    { path: "permissions.json", sizeBytes: 280 },
    { path: "migrations/001_create_backup_index.json", sizeBytes: 820 },
    { path: "assets/icon.svg", sizeBytes: 910 },
    { path: "module/actions.json", sizeBytes: 640 },
  ],
};

const availableModules: ModuleManifest[] = [
  EXAMPLE_MODULE_PACKAGE.manifest,
  {
    id: "smart-deduplicator",
    name: "Smart Deduplicator",
    description: "Find duplicate files and prepare cleanup suggestions without deleting data automatically.",
    version: "0.9.0",
    odriveVersion: ">=1.0.0",
    edition: "pro",
    author: "ODrive Labs",
    kind: "verified",
    dependencies: [],
    extensionPoints: [{ point: "dashboard.widget", label: "Duplicate risk" }],
  },
  {
    id: "audit-exporter",
    name: "Audit Exporter",
    description: "Export activity records for compliance review.",
    version: "0.5.0",
    odriveVersion: ">=1.0.0",
    edition: "enterprise",
    author: "Community",
    kind: "community",
    dependencies: [],
    extensionPoints: [{ point: "settings.panel", label: "Audit exports" }],
  },
];

const now = () => new Date().toISOString();
const entitlementKey = (workspaceId: string, moduleId: string) => `${workspaceId}:${moduleId}`;

function checksumFor(pkg: ModulePackageInput) {
  if (pkg.checksum) return pkg.checksum;
  const raw = `${pkg.fileName}:${pkg.sizeBytes}:${pkg.manifest.id}:${pkg.manifest.version}:${pkg.entries.map((entry) => `${entry.path}:${entry.sizeBytes}`).join("|")}`;
  let hash = 0;
  for (let index = 0; index < raw.length; index += 1) hash = (hash * 31 + raw.charCodeAt(index)) >>> 0;
  return `sha256:${hash.toString(16).padStart(8, "0")}`;
}

function isCompatible(range: string) {
  if (range === "*" || range === ODRIVE_VERSION) return true;
  const minimum = range.startsWith(">=") ? range.slice(2) : range;
  if (!SEMVER.test(minimum)) return false;
  const parse = (value: string) => value.split(".").map((part) => Number(part));
  const [major, minor, patch] = parse(ODRIVE_VERSION);
  const [minMajor, minMinor, minPatch] = parse(minimum);
  return major > minMajor || (major === minMajor && (minor > minMinor || (minor === minMinor && patch >= minPatch)));
}

function normalizePermissions(permissions: ModulePermission[]) {
  const known = new Map(MODULE_PERMISSION_CATALOG.map((permission) => [permission.id, permission]));
  return permissions.map((permission) => known.get(permission.id) ?? permission);
}

export function validateModulePackage(pkg: ModulePackageInput): ModuleValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const { manifest } = pkg;

  if (!pkg.fileName.endsWith(".zip")) errors.push("Package must be a .zip file.");
  if (pkg.sizeBytes <= 0 || pkg.sizeBytes > MAX_PACKAGE_BYTES) errors.push("Package size exceeds the 10 MB module limit.");
  if (!pkg.entries.length) errors.push("Package must include file entries.");
  if (pkg.entries.length > MAX_FILE_COUNT) errors.push("Package contains too many files.");
  if (!pkg.entries.some((entry) => entry.path === "manifest.json")) errors.push("manifest.json is required.");
  if (!pkg.entries.some((entry) => entry.path === "permissions.json")) errors.push("permissions.json is required.");
  if (!MODULE_ID.test(manifest.id)) errors.push("Manifest id must be lowercase kebab-case.");
  if (!manifest.name.trim()) errors.push("Manifest name is required.");
  if (!SEMVER.test(manifest.version)) errors.push("Manifest version must use semver.");
  if (!isCompatible(manifest.odriveVersion)) errors.push(`Module requires ODrive ${manifest.odriveVersion}; current runtime is ${ODRIVE_VERSION}.`);
  if (!["free", "pro", "enterprise", "private"].includes(manifest.edition)) errors.push("Manifest edition is invalid.");
  if (!["official", "verified", "community", "private"].includes(manifest.kind)) errors.push("Manifest module kind is invalid.");
  if (installed.has(manifest.id)) errors.push("A module with this id is already installed. Use update instead.");

  const seen = new Set<string>();
  for (const entry of pkg.entries) {
    if (entry.path.startsWith("/") || entry.path.includes("..") || entry.path.includes("\\")) {
      errors.push(`Unsafe package path: ${entry.path}`);
    }
    if (seen.has(entry.path)) errors.push(`Duplicate package path: ${entry.path}`);
    seen.add(entry.path);
    if (/\.(js|mjs|cjs|ts|tsx)$/i.test(entry.path)) {
      errors.push(`Executable module code is not allowed in Core runtime: ${entry.path}`);
    }
    if (entry.path.startsWith("migrations/") && !entry.path.endsWith(".json")) {
      errors.push(`Migration must be declarative JSON: ${entry.path}`);
    }
  }

  const knownPermissionIds = new Set(MODULE_PERMISSION_CATALOG.map((permission) => permission.id));
  for (const permission of pkg.permissions) {
    if (!knownPermissionIds.has(permission.id)) warnings.push(`Unknown permission will require manual review: ${permission.id}`);
  }
  if (!pkg.checksum) warnings.push("Package checksum was generated locally; signed publisher support is prepared but not enforced yet.");

  return { valid: errors.length === 0, errors, warnings };
}

export function entitlementFor(moduleId: string, edition: ModuleEdition, workspaceId = CURRENT_WORKSPACE): ModuleEntitlement {
  const override = entitlementOverrides.get(entitlementKey(workspaceId, moduleId));
  const free = edition === "free";
  return {
    moduleId,
    workspaceId,
    edition,
    entitled: override ?? free,
    reason: override ?? free ? "Workspace entitlement is active." : `${edition} entitlement is required.`,
  };
}

export async function setModuleEntitlement(moduleId: string, entitled: boolean, workspaceId = CURRENT_WORKSPACE) {
  entitlementOverrides.set(entitlementKey(workspaceId, moduleId), entitled);
  const module = installed.get(moduleId);
  if (module) module.entitlement = entitlementFor(moduleId, module.manifest.edition, workspaceId);
  await auditModule(moduleId, "module.entitlement", entitled ? "granted" : "revoked");
}

export async function installModulePackage(pkg: ModulePackageInput, workspaceId = CURRENT_WORKSPACE) {
  const validation = validateModulePackage(pkg);
  if (!validation.valid) throw new Error(validation.errors.join(" "));
  const timestamp = now();
  const module: InstalledModule = {
    manifest: pkg.manifest,
    permissions: normalizePermissions(pkg.permissions),
    grantedPermissions: pkg.permissions.map((permission) => permission.id),
    status: "installed",
    installedAt: timestamp,
    updatedAt: timestamp,
    packageChecksum: checksumFor(pkg),
    updateAvailable: false,
    entitlement: entitlementFor(pkg.manifest.id, pkg.manifest.edition, workspaceId),
    migrationState: pkg.entries.some((entry) => entry.path.startsWith("migrations/")) ? "pending" : "none",
  };
  installed.set(pkg.manifest.id, module);
  await auditModule(pkg.manifest.id, "module.installed", `version ${pkg.manifest.version}`);
  return module;
}

export async function installExampleModule() {
  return installModulePackage(EXAMPLE_MODULE_PACKAGE);
}

export async function enableModule(moduleId: string) {
  const module = requireInstalled(moduleId);
  if (!module.entitlement.entitled) {
    module.status = "blocked";
    await auditModule(moduleId, "module.enable.failed", module.entitlement.reason);
    throw new Error(module.entitlement.reason);
  }
  module.status = "enabled";
  module.enabledAt = now();
  module.migrationState = module.migrationState === "pending" ? "applied" : module.migrationState;
  module.updatedAt = now();
  await auditModule(moduleId, "module.enabled", "Module runtime enabled.");
  return module;
}

export async function disableModule(moduleId: string) {
  const module = requireInstalled(moduleId);
  module.status = "disabled";
  module.updatedAt = now();
  await auditModule(moduleId, "module.disabled", "Module disabled without deleting data.");
  return module;
}

export async function uninstallModule(moduleId: string, deleteData = false) {
  const module = requireInstalled(moduleId);
  if (deleteData) {
    await auditModule(moduleId, "module.uninstalled.with_data", "Module and module data removal requested.");
  } else {
    await auditModule(moduleId, "module.uninstalled", "Module removed; module data retained.");
  }
  installed.delete(module.manifest.id);
  return { moduleId, deleteData };
}

export async function updateModule(pkg: ModulePackageInput) {
  const current = requireInstalled(pkg.manifest.id);
  const validation = validateModulePackage({ ...pkg, manifest: { ...pkg.manifest, id: `${pkg.manifest.id}-update-check` } });
  if (!validation.valid) throw new Error(validation.errors.join(" "));
  const timestamp = now();
  current.manifest = pkg.manifest;
  current.permissions = normalizePermissions(pkg.permissions);
  current.packageChecksum = checksumFor(pkg);
  current.updateAvailable = false;
  current.updatedAt = timestamp;
  current.migrationState = pkg.entries.some((entry) => entry.path.startsWith("migrations/")) ? "pending" : current.migrationState;
  await auditModule(pkg.manifest.id, "module.updated", `version ${pkg.manifest.version}`);
  return current;
}

export function listModules(): ModuleRegistrySnapshot {
  const installedModules = [...installed.values()];
  const enabled = installedModules.filter((module) => module.status === "enabled");
  return {
    available: availableModules,
    installed: installedModules,
    runtime: {
      healthy: true,
      allowedActions: [...new Set(enabled.flatMap((module) => module.permissions.flatMap((permission) => permission.actionIds)))],
      extensionPoints: enabled.flatMap((module) => module.manifest.extensionPoints ?? []),
    },
  };
}

export async function runModuleAction<T = unknown>(
  moduleId: string,
  actionId: ActionId,
  input: Record<string, unknown>,
): Promise<ActionResult<T>> {
  const module = requireInstalled(moduleId);
  if (module.status !== "enabled") throw new Error("Module must be enabled before invoking actions.");
  if (!module.entitlement.entitled) throw new Error(module.entitlement.reason);
  const granted = new Set(module.permissions.flatMap((permission) => permission.actionIds));
  if (!granted.has(actionId)) throw new Error(`${module.manifest.name} is not granted ${actionId}.`);
  const actionPermissions = module.permissions.flatMap((permission) => permission.actionIds.includes(actionId) ? actionPermissionFor(permission.id) : []);
  return executeAction<T>(actionId, input, {
    workspaceId: CURRENT_WORKSPACE,
    source: "module",
    actor: {
      id: `module:${moduleId}`,
      type: "module",
      label: module.manifest.name,
      permissions: [...new Set(actionPermissions)],
    },
  });
}

function actionPermissionFor(modulePermissionId: string) {
  if (modulePermissionId === "files.read") return ["file:read"];
  if (modulePermissionId === "files.write") return ["file:write", "drive:write"];
  if (modulePermissionId === "transfers.create" || modulePermissionId === "transfers.manage") return ["transfer:write"];
  if (modulePermissionId === "backup.run") return ["automation:write", "transfer:write", "drive:read"];
  if (modulePermissionId === "shares.create") return ["share:write"];
  if (modulePermissionId === "automations.run") return ["automation:write"];
  return [];
}

function requireInstalled(moduleId: string) {
  const module = installed.get(moduleId);
  if (!module) throw new Error("Module is not installed.");
  return module;
}

async function auditModule(moduleId: string, action: string, target: string) {
  await log({
    category: "system",
    severity: action.includes("failed") ? "warning" : "info",
    message: `${action}: ${moduleId}`,
    context: { moduleId, target },
  }).catch(() => undefined);
}
