import { useAtomValue } from "@effect/atom-react";
import type { EnvironmentId } from "@t3tools/contracts";
import { useEffect, useMemo, useRef } from "react";

import {
  refreshArchivedThreadsForEnvironment,
  useArchivedThreadSnapshots,
} from "../../lib/archivedThreadsState";
import { environmentServerConfigsAtom } from "../../state/server";
import { threadEnvironment } from "../../state/threads";
import { useOrchestrationCommand } from "../../state/use-orchestration-command";

// Archive is one state now: the Archive shelf. Chats archived with the older
// hide-from-sidebar action move into the shelf once per environment, so no
// chat stays hidden in a place the sidebar no longer offers.
const MERGED_KEY_PREFIX = "leonidas:sidebar:archive-merged:";

function isMerged(environmentId: EnvironmentId): boolean {
  try {
    return window.localStorage.getItem(MERGED_KEY_PREFIX + environmentId) === "1";
  } catch {
    return true;
  }
}

function markMerged(environmentId: EnvironmentId): void {
  try {
    window.localStorage.setItem(MERGED_KEY_PREFIX + environmentId, "1");
  } catch {
    // Storage blocked: the merge retries next launch, which is harmless.
  }
}

export function useArchiveMerge(): void {
  const serverConfigs = useAtomValue(environmentServerConfigsAtom);
  const environmentIds = useMemo(
    () =>
      [...serverConfigs.entries()]
        .filter(
          ([environmentId, config]) =>
            config.environment.capabilities.threadSettlement === true && !isMerged(environmentId),
        )
        .map(([environmentId]) => environmentId),
    [serverConfigs],
  );
  const { snapshots, isLoading, error } = useArchivedThreadSnapshots(environmentIds);
  const unarchive = useOrchestrationCommand(threadEnvironment.unarchive, { reportFailure: false });
  const settle = useOrchestrationCommand(threadEnvironment.settle, { reportFailure: false });
  const running = useRef(new Set<EnvironmentId>());

  useEffect(() => {
    if (isLoading || error !== null) return;
    for (const { environmentId, snapshot } of snapshots) {
      if (running.current.has(environmentId) || isMerged(environmentId)) continue;
      running.current.add(environmentId);
      void (async () => {
        let allMoved = true;
        for (const thread of snapshot.threads) {
          const input = { threadId: thread.id };
          const restored = await unarchive({ environmentId, input });
          if (restored._tag === "Failure") {
            allMoved = false;
            continue;
          }
          const settled = await settle({ environmentId, input });
          if (settled._tag === "Failure") allMoved = false;
        }
        // A partial failure retries on the next launch; finished threads
        // are no longer archived, so they are not moved twice.
        if (allMoved) markMerged(environmentId);
        running.current.delete(environmentId);
        refreshArchivedThreadsForEnvironment(environmentId);
      })();
    }
  }, [error, isLoading, settle, snapshots, unarchive]);
}
