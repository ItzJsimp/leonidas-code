import type { ScopedThreadRef } from "@t3tools/contracts";
import { scopedThreadKey } from "@t3tools/client-runtime/environment";
import { useCallback, useEffect } from "react";

import { selectAttachedSubagent, useSubagentAttachStore } from "~/state/subagentAttach";
import { threadEnvironment } from "~/state/threads";
import { useOrchestrationCommand } from "~/state/use-orchestration-command";
import { resolveAttachedSubagent } from "./subagentThread.logic";

/**
 * Attach state for the composer. A chat on the server stores the attach on its
 * thread record, so it follows the chat to another computer and survives a
 * cleared browser. A draft chat keeps it on this device until the thread
 * exists, then moves it to the record once.
 *
 * `serverValue` is the shell's `attachedSubagent`: `undefined` when the chat is
 * a draft or the server predates the field, `null` when nothing is attached.
 */
export function useThreadSubagentAttach(input: {
  readonly threadRef: ScopedThreadRef;
  readonly serverValue: string | null | undefined;
}) {
  const { threadRef, serverValue } = input;
  const targetKey = scopedThreadKey(threadRef);
  const local = useSubagentAttachStore(selectAttachedSubagent(targetKey));
  const attachLocal = useSubagentAttachStore((state) => state.attach);
  const detachLocal = useSubagentAttachStore((state) => state.detach);
  const updateMetadata = useOrchestrationCommand(threadEnvironment.updateMetadata, {
    reportFailure: false,
  });
  const onServer = serverValue !== undefined;
  const { environmentId, threadId } = threadRef;

  useEffect(() => {
    if (!onServer || serverValue !== null || local === null) return;
    void updateMetadata({ environmentId, input: { threadId, attachedSubagent: local } });
    detachLocal(targetKey);
  }, [
    onServer,
    serverValue,
    local,
    updateMetadata,
    detachLocal,
    targetKey,
    environmentId,
    threadId,
  ]);

  const attach = useCallback(
    (name: string) => {
      if (onServer) {
        void updateMetadata({ environmentId, input: { threadId, attachedSubagent: name } });
      } else {
        attachLocal(targetKey, name);
      }
    },
    [onServer, updateMetadata, attachLocal, targetKey, environmentId, threadId],
  );
  const detach = useCallback(() => {
    detachLocal(targetKey);
    if (onServer) {
      void updateMetadata({ environmentId, input: { threadId, attachedSubagent: null } });
    }
  }, [onServer, updateMetadata, detachLocal, targetKey, environmentId, threadId]);

  return { attached: resolveAttachedSubagent(serverValue, local), attach, detach };
}
