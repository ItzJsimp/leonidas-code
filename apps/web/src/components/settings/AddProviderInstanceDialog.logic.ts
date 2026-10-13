export type WizardNavigation =
  | { readonly kind: "navigate"; readonly step: number }
  | { readonly kind: "blocked"; readonly step: number; readonly error: string };

const IDENTITY_STEP = 1;
const ACP_REGISTRY_IDENTITY_STEP = 1;

export const ADD_PROVIDER_WIZARD_STEPS = ["Provider", "Identity", "Config"] as const;
export const ACP_REGISTRY_WIZARD_STEPS = ["Provider", "Identity", "Sign in"] as const;
export const LOCAL_ACP_WIZARD_STEPS = ["Provider", "Identity"] as const;

export interface ProviderIdentityDraft {
  readonly label: string;
  readonly accentColor: string;
  readonly instanceIdOverride: string | null;
}

const EMPTY_PROVIDER_IDENTITY_DRAFT: ProviderIdentityDraft = {
  label: "",
  accentColor: "",
  instanceIdOverride: null,
};

export function getProviderIdentityDraft(
  drafts: Readonly<Record<string, ProviderIdentityDraft>>,
  driver: string,
): ProviderIdentityDraft {
  return drafts[driver] ?? EMPTY_PROVIDER_IDENTITY_DRAFT;
}

export function updateProviderIdentityDraft(
  drafts: Readonly<Record<string, ProviderIdentityDraft>>,
  driver: string,
  update: Partial<ProviderIdentityDraft>,
): Record<string, ProviderIdentityDraft> {
  return {
    ...drafts,
    [driver]: { ...getProviderIdentityDraft(drafts, driver), ...update },
  };
}

export function deriveAvailableInstanceId(
  derive: (label: string) => string,
  label: string,
  existing: ReadonlySet<string>,
): string {
  const base = derive(label);
  if (!base || !existing.has(base)) return base;

  for (let suffix = 2; ; suffix += 1) {
    const suffixText = `_${suffix}`;
    const candidate = `${base.slice(0, 64 - suffixText.length)}${suffixText}`;
    if (!existing.has(candidate)) return candidate;
  }
}

export function isConfiguredAcpRegistryAgent(
  instances: Readonly<Record<string, { readonly driver: string; readonly config?: unknown }>>,
  agentId: string,
): boolean {
  return Object.values(instances).some((instance) => {
    if (
      instance.driver !== "acpRegistry" ||
      !instance.config ||
      typeof instance.config !== "object"
    ) {
      return false;
    }
    const config = instance.config as Record<string, unknown>;
    return config.source !== "local" && config.agentId === agentId;
  });
}

/**
 * Resolve navigation within the add-provider wizard.
 *
 * Moving forward past Identity requires a valid instance id, whether the user
 * advances one step at a time or skips directly to Config from a step header.
 * A blocked skip lands on Identity so its existing inline validation is
 * visible. Backward navigation is always preserved.
 */
export function resolveWizardNavigation(
  currentStep: number,
  requestedStep: number,
  stepCount: number,
  validation: {
    readonly instanceIdError: string | null;
    readonly identityStep?: number;
    readonly prerequisite?: {
      readonly step: number;
      readonly error: string | null;
    };
  },
): WizardNavigation {
  const lastStep = Math.max(0, stepCount - 1);
  const targetStep = Math.max(0, Math.min(lastStep, requestedStep));
  const identityStep = validation.identityStep ?? IDENTITY_STEP;
  const prerequisite = validation.prerequisite;

  if (prerequisite?.error && currentStep <= prerequisite.step && targetStep > prerequisite.step) {
    return {
      kind: "blocked",
      step: Math.min(prerequisite.step, lastStep),
      error: prerequisite.error,
    };
  }

  const movesForwardPastIdentity = currentStep <= identityStep && targetStep > identityStep;

  if (movesForwardPastIdentity && validation.instanceIdError !== null) {
    return {
      kind: "blocked",
      step: Math.min(identityStep, lastStep),
      error: validation.instanceIdError,
    };
  }

  return { kind: "navigate", step: targetStep };
}

/** `Claude`, then `Claude 2`, `Claude 3`... the first name no existing account uses. */
export function deriveAccountLabel(
  baseName: string,
  existingLabels: ReadonlyArray<string>,
): string {
  const taken = new Set(existingLabels.map((label) => label.trim().toLowerCase()));
  if (!taken.has(baseName.trim().toLowerCase())) return baseName;
  for (let suffix = 2; ; suffix += 1) {
    const candidate = `${baseName} ${suffix}`;
    if (!taken.has(candidate.toLowerCase())) return candidate;
  }
}

const normalizeHomePath = (value: string) =>
  value.trim().replaceAll("\\", "/").replace(/\/+$/, "").toLowerCase();

/**
 * Claude keeps one login per config folder (CLAUDE_CONFIG_DIR, the instance's
 * `homePath`). The first account may use the default folder; every later one
 * needs its own, or it silently reuses the first account's login.
 * Returns undefined when the default folder is still free.
 */
export function deriveClaudeHomePath(input: {
  readonly label: string;
  readonly defaultSlotInUse: boolean;
  readonly existingHomePaths: ReadonlyArray<string>;
}): string | undefined {
  if (!input.defaultSlotInUse) return undefined;
  const slug =
    input.label
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "account";
  const taken = new Set(input.existingHomePaths.map(normalizeHomePath));
  taken.add(normalizeHomePath("~/.claude"));
  for (let suffix = 1; ; suffix += 1) {
    const candidate = suffix === 1 ? `~/.claude-${slug}` : `~/.claude-${slug}-${suffix}`;
    if (!taken.has(normalizeHomePath(candidate))) return candidate;
  }
}

type InstanceRecord = Readonly<
  Record<string, { readonly driver: string; readonly config?: unknown } | undefined>
>;

/** Whether a Claude account already occupies the default config folder. */
export function isClaudeDefaultSlotInUse(
  instances: InstanceRecord,
  providers: ReadonlyArray<{
    readonly instanceId: string;
    readonly driver: string;
    readonly auth: { readonly status: string };
  }>,
): boolean {
  const configured = Object.values(instances).some(
    (instance) => instance?.driver === "claudeAgent",
  );
  const defaultSignedIn = providers.some(
    (provider) =>
      provider.driver === "claudeAgent" &&
      provider.instanceId === "claudeAgent" &&
      provider.auth.status === "authenticated",
  );
  return configured || defaultSignedIn;
}

/** Collect the `homePath` values already claimed by Claude instances. */
export function collectClaudeHomePaths(instances: InstanceRecord): ReadonlyArray<string> {
  const paths: string[] = [];
  for (const instance of Object.values(instances)) {
    if (instance?.driver !== "claudeAgent") continue;
    const config = instance.config;
    if (config !== null && typeof config === "object") {
      const homePath = (config as Record<string, unknown>).homePath;
      if (typeof homePath === "string" && homePath.trim()) paths.push(homePath);
    }
  }
  return paths;
}

/**
 * When the new instance signs in as an email another instance of the same
 * driver already uses, return that instance's name so the dialog can say so.
 * Accounts in different workspaces of one email have separate quota and pass.
 */
export function findDuplicateAccount(
  providers: ReadonlyArray<{
    readonly instanceId: string;
    readonly driver: string;
    readonly displayName?: string | undefined;
    readonly auth: {
      readonly status: string;
      readonly email?: string | undefined;
      readonly workspaceId?: string | undefined;
    };
  }>,
  instanceId: string,
): string | null {
  const current = providers.find((provider) => provider.instanceId === instanceId);
  const email = current?.auth.status === "authenticated" ? current.auth.email?.toLowerCase() : null;
  if (!current || !email) return null;
  const other = providers.find(
    (provider) =>
      provider.instanceId !== instanceId &&
      provider.driver === current.driver &&
      provider.auth.status === "authenticated" &&
      provider.auth.email?.toLowerCase() === email &&
      (provider.auth.workspaceId ?? null) === (current.auth.workspaceId ?? null),
  );
  return other ? (other.displayName ?? other.instanceId) : null;
}

/** The four providers shown as big cards; everything else sits under "More providers". */
export const HEADLINE_PROVIDERS = [
  {
    driver: "claudeAgent",
    name: "Claude",
    blurb: "Anthropic's coding AI. Needs a Claude Pro or Max plan.",
  },
  {
    driver: "codex",
    name: "ChatGPT / Codex",
    blurb: "OpenAI's coding AI. Needs a ChatGPT Plus or Pro plan.",
  },
  {
    driver: "antigravity",
    name: "Google Antigravity",
    blurb: "Google's coding AI. Sign in with your Google account.",
  },
  {
    driver: "openrouter",
    name: "OpenRouter",
    blurb: "Pay-as-you-go access to many AIs. Needs an API key.",
  },
] as const;

export function resolveAcpRegistryWizardNavigation(
  currentStep: number,
  requestedStep: number,
  validation: {
    readonly instanceIdError: string | null;
    readonly selectionError: string | null;
  },
): WizardNavigation {
  return resolveWizardNavigation(currentStep, requestedStep, ACP_REGISTRY_WIZARD_STEPS.length, {
    instanceIdError: validation.instanceIdError,
    identityStep: ACP_REGISTRY_IDENTITY_STEP,
    prerequisite: { step: 0, error: validation.selectionError },
  });
}
