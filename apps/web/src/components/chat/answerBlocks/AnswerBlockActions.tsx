import { createContext, useContext } from "react";

/** Chat actions that answer blocks can call, such as sending a choice as a message. */
export interface AnswerBlockActions {
  sendMessage: (text: string) => Promise<void>;
}

export const AnswerBlockActionsContext = createContext<AnswerBlockActions | null>(null);

export const useAnswerBlockActions = () => useContext(AnswerBlockActionsContext);
