import { createContext, use } from "react";

import type { LiveArea } from "./liveArea";
import { IDLE } from "./useLiveArea";

export const CodeForwardContext = createContext<{
  rails: boolean;
  live: LiveArea;
  /** The chat pane shows beside the left pane, so the Command Center needs no Ask box. */
  chatBeside?: boolean;
}>({
  rails: false,
  live: IDLE,
});

/** Whether the Command Center rails show beside this chat. False outside State 2. */
export const useCodeForward = () => use(CodeForwardContext);
