import type { ProviderInstanceId, ServerProvider } from "@t3tools/contracts";

import type { ThreadRuntimeSummary } from "./models.ts";

type AccountIdentity = Pick<ServerProvider, "instanceId" | "driver" | "auth" | "continuation"> & {
  /** Instance ids repeat across environments, so scope them when known. */
  readonly environmentId?: string;
  readonly usageLimits?: Pick<NonNullable<ServerProvider["usageLimits"]>, "credentialFingerprint">;
};

/**
 * Stable key for the underlying account behind a provider instance. Instances
 * sharing a continuation group, a driver+email, or a credential fingerprint are
 * the same account (the same rules failover uses to skip a limited account).
 */
export function resolveAccountKey(entry: AccountIdentity): string {
  const group = entry.continuation?.groupKey;
  if (group) return `group:${group}`;
  const fingerprint = entry.usageLimits?.credentialFingerprint;
  if (fingerprint) return `cred:${fingerprint}`;
  const email = entry.auth?.email?.trim().toLowerCase();
  if (email) return `email:${entry.driver}:${email}`;
  return `instance:${scoped(entry.environmentId, entry.instanceId)}`;
}

const scoped = (environmentId: string | undefined, instanceId: string) =>
  environmentId ? `${environmentId}:${instanceId}` : instanceId;

/** Running or blocked on the user: the agents occupying an account right now. */
export function isAgentActive(runtime: ThreadRuntimeSummary | null | undefined): boolean {
  return runtime?.status === "running" || runtime?.status === "waiting";
}

/**
 * Active agents per account key. Delegated subagent tasks own threads, so
 * counting threads across every environment covers them too.
 */
export function countActiveAgentsByAccount(input: {
  readonly providers: ReadonlyArray<AccountIdentity>;
  readonly threads: Iterable<{
    readonly modelSelection: { readonly instanceId: ProviderInstanceId };
    readonly runtime: ThreadRuntimeSummary | null;
    readonly archivedAt?: string | null;
    readonly environmentId?: string;
  }>;
}): ReadonlyMap<string, number> {
  const keyByInstance = new Map<string, string>();
  for (const provider of input.providers) {
    keyByInstance.set(
      scoped(provider.environmentId, provider.instanceId),
      resolveAccountKey(provider),
    );
  }
  const counts = new Map<string, number>();
  for (const thread of input.threads) {
    if (thread.archivedAt || !isAgentActive(thread.runtime)) continue;
    const instanceId = thread.runtime?.providerInstanceId ?? thread.modelSelection.instanceId;
    const scopedId = scoped(thread.environmentId, instanceId);
    const key = keyByInstance.get(scopedId) ?? `instance:${scopedId}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}
