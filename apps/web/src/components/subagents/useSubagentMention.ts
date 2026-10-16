import { useMemo } from "react";

import { findSubagentMention, type ComposerSubagentOption } from "./subagentThread.logic";
import { useComposerSubagents } from "./useComposerSubagents";

/** The subagent an `@name` mention points at, or null when it is a file. */
export function useSubagentMention(path: string): ComposerSubagentOption | null {
  const options = useComposerSubagents();
  return useMemo(() => findSubagentMention(options, path), [options, path]);
}
