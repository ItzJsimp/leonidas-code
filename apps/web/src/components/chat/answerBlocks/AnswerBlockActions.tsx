import { createContext, useContext } from "react";

/** Chat actions that answer blocks can call. Blocks never send a message by themselves. */
export interface AnswerBlockActions {
  /** Put text in the composer; the user edits it and sends it by hand. */
  fillComposer: (text: string) => void;
}

export const AnswerBlockActionsContext = createContext<AnswerBlockActions | null>(null);

export const useAnswerBlockActions = () => useContext(AnswerBlockActionsContext);
