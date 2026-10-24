import { createContext, useContext, type ReactNode } from "react";

/** What a host (the chat pane) puts at the left end of the chat header. Null for none. */
export const ChatHeaderLeadingContext = createContext<ReactNode>(null);

export const useChatHeaderLeading = () => useContext(ChatHeaderLeadingContext);
