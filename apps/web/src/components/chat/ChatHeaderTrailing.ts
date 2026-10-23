import { createContext, useContext, type ReactNode } from "react";

/** What a host (the chat pane) puts at the right end of the chat header. Null for none. */
export const ChatHeaderTrailingContext = createContext<ReactNode>(null);

export const useChatHeaderTrailing = () => useContext(ChatHeaderTrailingContext);
