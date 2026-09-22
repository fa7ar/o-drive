import { DESCRIPTORS } from "@/adapters";
import { configStatus } from "@/config/runtime-env.server";
import { systemMetrics } from "@/core/health";
import { listModules, MODULE_REGISTRY_TABLES } from "@/core/modules";
import { listProviderStates, runHealthChecks } from "@/core/services";
import { useContainer } from "@/core/container";
import type { ProviderDescriptor, ProviderReadiness, ProviderState } from "@/core/types";

export type ReadinessState = "Healthy" | "Degraded" | "Testing" | "Blocked" | "Disabled";
export type DeploymentState = "READY" | "DEGRADED" | "BLOCKED";
export type VerificationTarget = "all" | "infrastructure" | "provider" | "feature";

export interface ReadinessItem {
  id: string;
  name: string;
  group: "Infrastructure" | "Providers" | "Core Features";
  state: ReadinessState;
  reason: string;
  lastVerifiedAt: string | null;
  critical?: boolean;
  publicStatus?: ProviderReadiness | "disabled";
  capabilities?: Array<{ name: string; state: ReadinessState; reason: string }>;
}

export interface VerificationResult {
  id: string;
  runId: string;
  target: VerificationTarget;
  check: string;
  status: ReadinessState;
  reason: string;
  durationMs: number;
  createdAt: string;
}

export interface VerificationRun {
  id: string;
  target: VerificationTarget;
  status: DeploymentState;
  reason: string;
  durationMs: number;
  createdAt: string;
  results: VerificationResult[];
}

export interface ReadinessReport {
  deployment: DeploymentState;
  reason: string;
  checkedAt: string;
  groups: {
    infrastructure: ReadinessItem[];
    providers: ReadinessItem[];
    features: ReadinessItem[];
  };
  blockers: ReadinessItem[];
  recentRuns: VerificationRun[];
  recentFailures: VerificationResult[];
}

const history: VerificationRun[] = [];

const now = () => new Date().toISOString();
const resultId = () => `vr_${Date.now()}_${Math.random().toString(16).slice(2)}`;

const REQUIRED_PROVIDER_OPS = [
  "OAuth/Auth",
  "Connection",
  "Health Check",
  "List",
  "Upload",
  "Download",
  "Search",
] as const;

const CAPABILITY_MATCH: Record<string, string[]> = {
  "OAuth/Auth": ["OAuth", "Bot API", "Upload", "Download"],
  Connection: ["OAuth", "Bot API", "Health", "Upload", "Download"],
  "Health Check": ["Health"],
  List: ["File operations", "File listing", "list"],
  Upload: ["Upload", "File operations"],
  Download: ["Download", "Streaming", "File operations"],
  Rename: ["File operations", "rename"],
  Move: ["copy/move", "File operations"],
  Copy: ["copy/move", "File operations"],
  Delete: ["File operations", "delete"],
  Search: ["Search", "File operations"],
  "Multiple Accounts": ["OAuth", "Bot API", "Upload", "Download", "File operations"],
  "Large Files": ["Streaming", "Download"],
};

const allCapabilityNames = [
  "OAuth/Auth",
  "Connection",
  "Health Check",
  "List",
  "Upload",
  "Download",
  "Rename",
  "Move",
  "Copy",
  "Delete",
  "Search",
  "Multiple Accounts",
  "Large Files",
];

function hasCapability(descriptor: ProviderDescriptor, capability: string) {
  const verified = descriptor.verifiedOperations ?? [];
  return (CAPABILITY_MATCH[capability] ?? [capability]).some((needle) =>
    verified.some((item) => item.toLowerCase().includes(needle.toLowerCase())),
  );
}

function providerPublicStatus(
  descriptor: ProviderDescriptor,
  state: ProviderState | undefined,
  capabilities: ReadinessItem["capabilities"],
): ProviderReadiness | "disabled" {
  if (state && !state.enabled) return "disabled";
  if (descriptor.readiness === "coming-soon") return "coming-soon";
  const requiredPassed = REQUIRED_PROVIDER_OPS.every((name) =>
    capabilities?.find((item) => item.name === name)?.state === "Healthy",
  );
  if (descriptor.readiness === "production" && state?.health === "healthy" && requiredPassed) {
    return "production";
  }
  if (descriptor.capability === "live") return "beta";
  return "coming-soon";
}

function mapProvider(
  descriptor: ProviderDescriptor,
  state: ProviderState | undefined,
  checkedAt: string,
): ReadinessItem {
  const disabled = state ? !state.enabled : false;
  const capabilities = allCapabilityNames.map((name) => {
    const supported = hasCapability(descriptor, name);
    return {
      name,
      state: supported ? ("Healthy" as const) : ("Disabled" as const),
      reason: supported ? "Declared by provider capability registry." : "Not declared by provider capability registry.",
    };
  });
  const publicStatus = providerPublicStatus(descriptor, state, capabilities);
  const requiredMissing = REQUIRED_PROVIDER_OPS.filter(
    (name) => capabilities.find((item) => item.name === name)?.state !== "Healthy",
  );

  if (disabled) {
    return {
      id: descriptor.id,
      name: descriptor.name,
      group: "Providers",
      state: "Disabled",
      reason: "Provider is disabled in admin configuration.",
      lastVerifiedAt: state?.checkedAt ?? checkedAt,
      publicStatus,
      capabilities,
    };
  }
  if (descriptor.readiness === "coming-soon") {
    return {
      id: descriptor.id,
      name: descriptor.name,
      group: "Providers",
      state: "Disabled",
      reason: "Provider is registered but not launchable yet.",
      lastVerifiedAt: state?.checkedAt ?? checkedAt,
      publicStatus,
      capabilities,
    };
  }
  if (requiredMissing.length > 0) {
    return {
      id: descriptor.id,
      name: descriptor.name,
      group: "Providers",
      state: "Testing",
      reason: `Missing required capability declaration: ${requiredMissing.join(", ")}.`,
      lastVerifiedAt: state?.checkedAt ?? checkedAt,
      publicStatus,
      capabilities,
    };
  }
  if (!state?.checkedAt || state.health === "unknown") {
    return {
      id: descriptor.id,
      name: descriptor.name,
      group: "Providers",
      state: descriptor.readiness === "production" ? "Degraded" : "Testing",
      reason: "No live health verification has been recorded yet.",
      lastVerifiedAt: state?.checkedAt ?? null,
      critical: descriptor.readiness === "production",
      publicStatus,
      capabilities,
    };
  }
  if (state.health === "healthy") {
    return {
      id: descriptor.id,
      name: descriptor.name,
      group: "Providers",
      state: descriptor.readiness === "production" ? "Healthy" : "Testing",
      reason: descriptor.readiness === "production" ? "Required capabilities and health check passed." : "Live adapter is healthy but remains beta until E2E validation passes.",
      lastVerifiedAt: state.checkedAt,
      publicStatus,
      capabilities,
    };
  }
  return {
    id: descriptor.id,
    name: descriptor.name,
    group: "Providers",
    state: state.health === "down" ? "Blocked" : "Degraded",
    reason: `Last provider health check reported ${state.health}.`,
    lastVerifiedAt: state.checkedAt,
    critical: descriptor.readiness === "production",
    publicStatus,
    capabilities,
  };
}

function deploymentFrom(items: ReadinessItem[]): { deployment: DeploymentState; reason: string } {
  const blocker = items.find((item) => item.critical && (item.state === "Blocked" || item.state === "Degraded"));
  if (blocker) return { deployment: "BLOCKED", reason: `${blocker.name}: ${blocker.reason}` };
  const anyBlocked = items.find((item) => item.state === "Blocked");
  if (anyBlocked) return { deployment: "DEGRADED", reason: `${anyBlocked.name}: ${anyBlocked.reason}` };
  const anyDegraded = items.find((item) => item.state === "Degraded" || item.state === "Testing");
  if (anyDegraded) return { deployment: "DEGRADED", reason: `${anyDegraded.name}: ${anyDegraded.reason}` };
  return { deployment: "READY", reason: "All critical readiness checks are healthy." };
}

export async function readinessReport(): Promise<ReadinessReport> {
  const checkedAt = now();
  const [providerStates, metrics, jobs, logs] = await Promise.all([
    listProviderStates(),
    systemMetrics(),
    useContainer().jobs.list(200),
    useContainer().logs.list({ limit: 200 }),
  ]);
  const config = configStatus();
  const stateById = new Map(providerStates.map((state) => [state.providerId, state]));
  const missingSecrets = config.variables.filter((item) => item.kind === "secret" && item.required && !item.present);
  const missingRequired = config.variables.filter((item) => item.required && !item.present);
  const modules = listModules();

  const infrastructure: ReadinessItem[] = [
    {
      id: "database",
      name: "Database",
      group: "Infrastructure",
      state: config.variables.find((item) => item.name === "SUPABASE_URL")?.present && config.variables.find((item) => item.name === "SUPABASE_SERVICE_ROLE_KEY")?.present ? "Healthy" : "Blocked",
      reason: missingRequired.some((item) => item.feature.includes("database")) ? "Required database runtime variable is missing." : "Required database variables are present.",
      lastVerifiedAt: checkedAt,
      critical: true,
    },
    {
      id: "queue",
      name: "Queue",
      group: "Infrastructure",
      state: jobs.filter((job) => job.status === "failed").length > 0 ? "Degraded" : "Healthy",
      reason: `${jobs.filter((job) => job.status === "queued").length} queued, ${jobs.filter((job) => job.status === "failed").length} failed jobs.`,
      lastVerifiedAt: checkedAt,
    },
    {
      id: "cache",
      name: "Cache",
      group: "Infrastructure",
      state: "Testing",
      reason: "No dedicated cache binding is registered; runtime relies on database and in-process caches.",
      lastVerifiedAt: checkedAt,
    },
    {
      id: "secrets",
      name: "Secrets",
      group: "Infrastructure",
      state: missingSecrets.length ? "Blocked" : "Healthy",
      reason: missingSecrets.length ? `Missing required secret(s): ${missingSecrets.map((item) => item.name).join(", ")}.` : "Required secrets are present.",
      lastVerifiedAt: checkedAt,
      critical: true,
    },
    {
      id: "authentication",
      name: "Authentication",
      group: "Infrastructure",
      state: config.variables.find((item) => item.name === "SUPABASE_PUBLISHABLE_KEY")?.present ? "Healthy" : "Blocked",
      reason: config.variables.find((item) => item.name === "SUPABASE_PUBLISHABLE_KEY")?.present ? "Supabase auth public key is configured." : "Supabase publishable key is missing.",
      lastVerifiedAt: checkedAt,
      critical: true,
    },
    {
      id: "storage",
      name: "Storage/bindings",
      group: "Infrastructure",
      state: "Healthy",
      reason: "Storage adapters are registered through the provider registry.",
      lastVerifiedAt: checkedAt,
    },
    {
      id: "email",
      name: "Email",
      group: "Infrastructure",
      state: config.variables.find((item) => item.name === "LOVABLE_API_KEY")?.present ? "Healthy" : "Degraded",
      reason: config.variables.find((item) => item.name === "LOVABLE_API_KEY")?.present ? "Email provider key is present." : "Transactional email key is not configured.",
      lastVerifiedAt: checkedAt,
    },
    {
      id: "scheduler",
      name: "Scheduler",
      group: "Infrastructure",
      state: config.variables.find((item) => item.name === "LOVABLE_CRON_SECRET")?.present ? "Healthy" : "Degraded",
      reason: config.variables.find((item) => item.name === "LOVABLE_CRON_SECRET")?.present ? "Cron secret is present." : "Cron secret is missing; scheduled calls cannot be authenticated.",
      lastVerifiedAt: checkedAt,
    },
  ];

  const providers = DESCRIPTORS.map((descriptor) => mapProvider(descriptor, stateById.get(descriptor.id), checkedAt));
  const features: ReadinessItem[] = [
    ["explorer", "Explorer", "Healthy", "Explorer uses the provider registry and metadata index."],
    ["search", "Search", "Healthy", "Search repository is available through the service layer."],
    ["upload", "Upload", "Healthy", "Upload pipeline and transfer queue are registered."],
    ["download", "Download", "Healthy", "Download and streaming paths are registered."],
    ["transfer", "Transfer", metrics.jobsFailed ? "Degraded" : "Healthy", `${metrics.jobsRunning} running, ${metrics.jobsFailed} failed jobs.`],
    ["sharing", "Sharing", "Healthy", "Share repository and public share route are registered."],
    ["automation", "Automation", config.variables.find((item) => item.name === "LOVABLE_CRON_SECRET")?.present ? "Healthy" : "Degraded", "Automation depends on scheduler authentication for cron runs."],
    ["activity", "Activity", logs.some((log) => log.severity === "critical") ? "Degraded" : "Healthy", `${logs.filter((log) => log.severity === "critical").length} critical logs in recent window.`],
    ["public-api", "Public API", "Healthy", "Public v1 API router is registered."],
    ["webhooks", "Webhooks", "Testing", "Webhook registry exists; delivery verification requires live endpoints."],
    ["content", "Content Management", "Healthy", "Unified content editor and public routes are registered."],
    ["module-runtime", "Module Runtime", modules.runtime.healthy ? "Healthy" : "Blocked", "Modules invoke ODrive through the Universal Action Layer and cannot execute arbitrary package code."],
    ["module-registry", "Module Registry", MODULE_REGISTRY_TABLES.length === 7 ? "Healthy" : "Degraded", `${MODULE_REGISTRY_TABLES.length} registry tables are modeled for module state.`],
    ["module-package-storage", "Package Storage", "Healthy", "Package records use storage abstraction metadata and avoid local filesystem assumptions."],
    ["module-entitlements", "Entitlement Service", modules.installed.some((module) => !module.entitlement.entitled && module.manifest.edition !== "free") ? "Testing" : "Healthy", "Installation and entitlement are tracked separately per workspace."],
  ].map(([id, name, state, reason]) => ({
    id,
    name,
    group: "Core Features" as const,
    state: state as ReadinessState,
    reason,
    lastVerifiedAt: checkedAt,
  }));

  const all = [...infrastructure, ...providers, ...features];
  const { deployment, reason } = deploymentFrom(all);
  const recentFailures = history.flatMap((run) => run.results).filter((item) => item.status === "Blocked" || item.status === "Degraded").slice(0, 10);
  return {
    deployment,
    reason,
    checkedAt,
    groups: { infrastructure, providers, features },
    blockers: all.filter((item) => item.state === "Blocked" || (item.critical && item.state === "Degraded")),
    recentRuns: history.slice(0, 10),
    recentFailures,
  };
}

export async function runVerification(target: VerificationTarget = "all", providerId?: string): Promise<VerificationRun> {
  const started = Date.now();
  if (target === "all" || target === "provider") await runHealthChecks();
  const report = await readinessReport();
  const allItems = [...report.groups.infrastructure, ...report.groups.providers, ...report.groups.features];
  const filtered = allItems.filter((item) => {
    if (providerId) return item.group === "Providers" && item.id === providerId;
    if (target === "infrastructure") return item.group === "Infrastructure";
    if (target === "provider") return item.group === "Providers";
    if (target === "feature") return item.group === "Core Features";
    return true;
  });
  const runId = resultId();
  const results = filtered.map((item) => ({
    id: resultId(),
    runId,
    target,
    check: item.name,
    status: item.state,
    reason: item.reason,
    durationMs: Date.now() - started,
    createdAt: report.checkedAt,
  }));
  const scoped = deploymentFrom(filtered);
  const run: VerificationRun = {
    id: runId,
    target,
    status: scoped.deployment,
    reason: scoped.reason,
    durationMs: Date.now() - started,
    createdAt: report.checkedAt,
    results,
  };
  history.unshift(run);
  history.splice(25);
  return run;
}

export async function publicProviderReadiness() {
  const report = await readinessReport();
  return report.groups.providers.map((provider) => ({
    id: provider.id,
    publicStatus: provider.publicStatus ?? "coming-soon",
    state: provider.state,
    reason: provider.reason,
  }));
}
