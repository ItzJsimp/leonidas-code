import { createContext, use } from "react";

export const CodeForwardContext = createContext<{
  rails: boolean;
  /** The chat pane shows beside the left pane, so the Command Center needs no Ask box. */
  chatBeside?: boolean;
}>({
  rails: false,
});

/** Whether the Command Center rails show beside this chat. False outside State 2. */
export const useCodeForward = () => use(CodeForwardContext);
