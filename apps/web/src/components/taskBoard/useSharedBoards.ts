import type { EnvironmentId, TaskBoardTask } from "@t3tools/contracts";
import { useAtomValue } from "@effect/atom-react";
import * as Option from "effect/Option";
import { AsyncResult, Atom } from "effect/reactivity";
import { useCallback, useMemo } from "react";

import { appAtomRegistry } from "~/rpc/atomRegistry";
import { formatEnvironmentQueryError } from "~/state/query";
import { taskBoardQuery } from "~/state/taskBoard";

export type SharedBoardTarget = { readonly slug: string; readonly projectId: string };

export type SharedBoards = {
  /** Every shared task, tagged with the slug of the project whose board it came from. */
  readonly tasks: ReadonlyArray<TaskBoardTask>;
  /** First failure message; boards that did load still show. */
  readonly error: string | null;
  readonly isPending: boolean;
  readonly refresh: () => void;
};

const NONE: ReadonlyArray<TaskBoardTask> = [];

/**
 * Reads the shared board of every given project at once, so a project a collaborator shares
 * appears on the Tasks page without being selected first.
 */
export function useSharedBoards(
  environmentId: EnvironmentId | null,
  targets: ReadonlyArray<SharedBoardTarget>,
): SharedBoards {
  const key = targets.map((target) => `${target.slug}:${target.projectId}`).join("|");
  const queries = useMemo(
    () =>
      environmentId
        ? targets.map((target) => ({
            slug: target.slug,
            atom: taskBoardQuery({
              environmentId,
              input: { projectId: target.projectId as never },
            }),
          }))
        : [],
    // `key` stands in for `targets`, which is rebuilt on every render.
    [environmentId, key],
  );
  const combined = useMemo(
    () =>
      Atom.make((get) =>
        queries.map(({ slug, atom }) => {
          const result = get(atom);
          return {
            slug,
            tasks: Option.getOrNull(AsyncResult.value(result))?.tasks ?? NONE,
            error: result._tag === "Failure" ? formatEnvironmentQueryError(result.cause) : null,
            pending: result.waiting,
          };
        }),
      ),
    [queries],
  );
  const boards = useAtomValue(combined);

  const refresh = useCallback(() => {
    for (const { atom } of queries) appAtomRegistry.refresh(atom);
  }, [queries]);

  return useMemo(
    () => ({
      tasks: boards.flatMap((board) =>
        board.tasks.map((task) => ({ ...task, projectSlug: board.slug })),
      ),
      error: boards.find((board) => board.error)?.error ?? null,
      isPending: boards.some((board) => board.pending),
      refresh,
    }),
    [boards, refresh],
  );
}
