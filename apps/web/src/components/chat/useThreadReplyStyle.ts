import type { ScopedThreadRef } from "@t3tools/contracts";
import { scopedThreadKey } from "@t3tools/client-runtime/environment";
import { useCallback, useEffect } from "react";
import { create } from "zustand";
import { persist } from "zustand/middleware";

import { threadEnvironment } from "~/state/threads";
import { useOrchestrationCommand } from "~/state/use-orchestration-command";

interface DraftReplyStyleState {
  /** Reply style chosen in a draft chat, per composer target, until the thread exists. */
  readonly byTarget: Readonly<Record<string, string>>;
  readonly choose: (targetKey: string, slug: string) => void;
  readonly forget: (targetKey: string) => void;
}

const useDraftReplyStyleStore = create<DraftReplyStyleState>()(
  persist(
    (set) => ({
      byTarget: {},
      choose: (targetKey, slug) =>
        set((state) => ({ byTarget: { ...state.byTarget, [targetKey]: slug } })),
      forget: (targetKey) =>
        set((state) => {
          const { [targetKey]: _removed, ...rest } = state.byTarget;
          return { byTarget: rest };
        }),
    }),
    { name: "leonidas:reply-style-draft:v1" },
  ),
);

/**
 * This chat's reply style choice. A server chat stores it on its thread record; a draft keeps
 * it on this device and moves it to the record once the thread exists (like the subagent attach).
 *
 * `serverValue` is the shell's `replyStyle`: `undefined` for a draft, `null` for no choice.
 */
export function useThreadReplyStyle(input: {
  readonly threadRef: ScopedThreadRef;
  readonly serverValue: string | null | undefined;
}) {
  const { threadRef, serverValue } = input;
  const targetKey = scopedThreadKey(threadRef);
  const local = useDraftReplyStyleStore((state) => state.byTarget[targetKey] ?? null);
  const chooseLocal = useDraftReplyStyleStore((state) => state.choose);
  const forgetLocal = useDraftReplyStyleStore((state) => state.forget);
  const updateMetadata = useOrchestrationCommand(threadEnvironment.updateMetadata, {
    reportFailure: false,
  });
  const onServer = serverValue !== undefined;
  const { environmentId, threadId } = threadRef;

  useEffect(() => {
    if (!onServer || local === null) return;
    if (serverValue === null) {
      void updateMetadata({ environmentId, input: { threadId, replyStyle: local } });
    }
    forgetLocal(targetKey);
  }, [
    onServer,
    serverValue,
    local,
    updateMetadata,
    forgetLocal,
    targetKey,
    environmentId,
    threadId,
  ]);

  const choose = useCallback(
    (slug: string) => {
      if (onServer) {
        void updateMetadata({ environmentId, input: { threadId, replyStyle: slug } });
      } else {
        chooseLocal(targetKey, slug);
      }
    },
    [onServer, updateMetadata, chooseLocal, targetKey, environmentId, threadId],
  );

  return { chatSlug: onServer ? (serverValue ?? null) : local, choose };
}

/** The draft's chosen style as a launch field, so the first reply uses it. */
export function draftReplyStyleField(threadRef: ScopedThreadRef): { replyStyle?: string } {
  const slug = useDraftReplyStyleStore.getState().byTarget[scopedThreadKey(threadRef)];
  return slug === undefined ? {} : { replyStyle: slug };
}
