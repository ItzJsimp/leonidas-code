import { useMemo } from "react";

import { usePrimaryEnvironmentId } from "~/state/environments";
import { useEnvironmentQuery } from "~/state/query";
import { subagentsComposerQuery } from "~/state/subagents";
import { composerSubagentOptions, type ComposerSubagentOption } from "./subagentThread.logic";

const NONE: ReadonlyArray<ComposerSubagentOption> = [];

/** Subagents a chat can name or attach, live from the Studio catalog. */
export function useComposerSubagents(): ReadonlyArray<ComposerSubagentOption> {
  const environmentId = usePrimaryEnvironmentId();
  const catalog = useEnvironmentQuery(
    environmentId ? subagentsComposerQuery({ environmentId, input: {} }) : null,
  );
  const entries = catalog.data?.entries;
  return useMemo(() => (entries ? composerSubagentOptions(entries) : NONE), [entries]);
}
