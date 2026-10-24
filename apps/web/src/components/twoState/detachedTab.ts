import { createContext, useContext } from "react";

/** A rail window shown outside its route keeps its tab here instead of in the URL. */
export const DetachedTabContext = createContext<{
  readonly tab: string | null;
  readonly setTab: (tab: string | null) => void;
} | null>(null);

export const useDetachedTab = () => useContext(DetachedTabContext);
