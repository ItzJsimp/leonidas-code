import { createContext, use } from "react";

import type { LiveArea } from "./liveArea";
import { IDLE } from "./useLiveArea";

export const CodeForwardContext = createContext<{ rails: boolean; live: LiveArea }>({
  rails: false,
  live: IDLE,
});

/** Whether the Command Center rails show beside this chat. False outside State 2. */
export const useCodeForward = () => use(CodeForwardContext);
