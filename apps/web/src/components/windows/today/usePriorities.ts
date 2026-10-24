import {
  isAtomCommandInterrupted,
  squashAtomCommandFailure,
} from "@t3tools/client-runtime/state/runtime";
import { useCallback, useMemo, useRef, useState } from "react";

import { toastManager } from "~/components/ui/toast";
import { useActiveAiosWorkspace } from "~/components/workspace/useActiveAiosWorkspace";
import { failureText } from "~/components/taskBoard/useTaskActions.logic";
import { taskBoardHomePriorityToggle } from "~/state/taskBoard";
import { useAtomCommand } from "~/state/use-atom-command";

import { useAiosHome } from "../../twoState/useTwoStateData";
import { type PriorityOverride, type PriorityView, priorityViews } from "./today.logic";

const NO_PRIORITIES: readonly never[] = [];

type LocalTick = PriorityOverride & {
  readonly pending: boolean;
  /** The read time when the tick was made; a newer read replaces it. */
  readonly at: number;
};

/**
 * Today's priorities with a tick that writes the brief file. A tick shows at once; a failure
 * puts the box back and shows a toast. Today and the Command Center card both use this.
 */
export function usePriorities() {
  const home = useAiosHome();
  const { environmentId, scope } = useActiveAiosWorkspace();
  const run = useAtomCommand(taskBoardHomePriorityToggle, { reportFailure: false });
  const [overrides, setOverrides] = useState<ReadonlyMap<string, LocalTick>>(() => new Map());
  const pending = useRef(new Set<string>());

  const brief = home.data?.brief ?? null;
  const refresh = home.refresh;
  const readAt = home.dataUpdatedAt;
  const priorities = useMemo(() => {
    // A read newer than a confirmed tick is the truth again; a tick on its way always shows.
    const live = new Map([...overrides].filter(([, tick]) => tick.pending || tick.at >= readAt));
    return priorityViews(brief?.priorities ?? NO_PRIORITIES, live);
  }, [brief, overrides, readAt]);

  const setOverride = useCallback(
    (key: string, value: LocalTick | null) =>
      setOverrides((current) => {
        const next = new Map(current);
        if (value) next.set(key, value);
        else next.delete(key);
        return next;
      }),
    [],
  );

  const toggle = useCallback(
    async (priority: PriorityView) => {
      const line = priority.line;
      if (!environmentId || !brief || line === undefined || priority.locked !== null) return;
      if (pending.current.has(priority.key)) return;
      const done = !priority.done;
      pending.current.add(priority.key);
      setOverride(priority.key, { done, line, pending: true, at: readAt });
      const result = await run({
        environmentId,
        input: { ...scope, file: brief.file, line, done },
      });
      pending.current.delete(priority.key);
      if (result._tag === "Success") {
        setOverride(priority.key, { done, line: result.value.line, pending: false, at: readAt });
      } else {
        setOverride(priority.key, null);
        if (!isAtomCommandInterrupted(result)) {
          toastManager.add({
            type: "error",
            title: done
              ? `Could not tick "${priority.title}"`
              : `Could not clear "${priority.title}"`,
            description: failureText(
              squashAtomCommandFailure(result),
              "The brief file could not be saved. Try again.",
            ),
          });
        }
      }
      refresh();
    },
    [brief, environmentId, readAt, refresh, run, scope, setOverride],
  );

  return { home, brief, priorities, toggle };
}
