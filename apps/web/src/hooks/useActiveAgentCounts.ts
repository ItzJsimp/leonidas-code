import {
  countActiveAgentsByAccount,
  resolveAccountKey,
} from "@t3tools/client-runtime/state/activeAgentCounts";
import { useAtomValue } from "@effect/atom-react";
import { useMemo } from "react";

import { environmentPresentations } from "../state/presentation";
import { useThreadShells } from "../state/entities";

/**
 * Running agents per provider instance, summed over every connected environment
 * and merged across instances that share one underlying account. Look up by
 * `${environmentId}:${instanceId}` (the usage account id); 0 means nothing runs.
 */
export function useActiveAgentCounts(): (scopedInstanceId: string) => number {
  const threads = useThreadShells();
  const presentations = useAtomValue(environmentPresentations.presentationsAtom);
  return useMemo(() => {
    const providers = [...presentations].flatMap(([environmentId, presentation]) =>
      (presentation.serverConfig?.providers ?? []).map((provider) => ({
        ...provider,
        environmentId: String(environmentId),
      })),
    );
    const byAccount = countActiveAgentsByAccount({ providers, threads });
    const keys = new Map(
      providers.map((p) => [`${p.environmentId}:${p.instanceId}`, resolveAccountKey(p)]),
    );
    return (scopedInstanceId) => {
      const key = keys.get(scopedInstanceId);
      return key ? (byAccount.get(key) ?? 0) : 0;
    };
  }, [presentations, threads]);
}
