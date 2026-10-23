import { useMemo } from "react";
import { useParams } from "@tanstack/react-router";
import { useComposerDraftStore, type ComposerThreadTarget } from "~/composerDraftStore";
import { resolveThreadRouteTarget } from "~/threadRoutes";
import { useThreadShell } from "~/state/entities";
import { useRouteOrShownThreadRef } from "../twoState/shownChatContext";
import { useProjectAiosWorkspace } from "../workspace/useProjectAiosWorkspace";

import { useEnvironmentQuery } from "~/state/query";
import { subagentsComposerQuery } from "~/state/subagents";
import { composerSubagentOptions, type ComposerSubagentOption } from "./subagentThread.logic";

const NONE: ReadonlyArray<ComposerSubagentOption> = [];

/** Subagents a chat can name or attach, live from the Studio catalog. */
export function useComposerSubagents(
  target?: ComposerThreadTarget | null,
): ReadonlyArray<ComposerSubagentOption> {
  const params = useParams({ strict: false });
  const route = useMemo(() => resolveThreadRouteTarget(params), [params]);
  const shown = useRouteOrShownThreadRef(null);
  const resolvedTarget =
    target ?? (route ? (route.kind === "server" ? route.threadRef : route.draftId) : shown);
  const serverThread = useThreadShell(typeof resolvedTarget === "object" ? resolvedTarget : null);
  const draft = useComposerDraftStore((store) =>
    typeof resolvedTarget === "string"
      ? store.getDraftSession(resolvedTarget)
      : resolvedTarget
        ? store.getDraftSessionByRef(resolvedTarget)
        : null,
  );
  const thread = serverThread ?? draft;
  const workspace = useProjectAiosWorkspace(
    thread ? { environmentId: thread.environmentId, projectId: thread.projectId } : null,
  );
  const { environmentId } = workspace;
  const catalog = useEnvironmentQuery(
    environmentId && workspace.scopeReady && (!resolvedTarget || thread)
      ? subagentsComposerQuery({ environmentId, input: workspace.scope })
      : null,
  );
  const entries = catalog.data?.entries;
  return useMemo(() => (entries ? composerSubagentOptions(entries) : NONE), [entries]);
}
