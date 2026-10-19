import { create } from "zustand";

// Per device: which AIOS workspace this window shows, keyed by environment id.
const ACTIVE_WORKSPACE_KEY = "leonidas:workspace:active";

function readStored(): Readonly<Record<string, string>> {
  if (typeof window === "undefined") return {};
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(ACTIVE_WORKSPACE_KEY) ?? "{}");
    if (typeof parsed !== "object" || parsed === null) return {};
    return Object.fromEntries(
      Object.entries(parsed).filter(
        (entry): entry is [string, string] => typeof entry[1] === "string",
      ),
    );
  } catch {
    return {};
  }
}

interface AiosWorkspaceStore {
  /** The id the user picked, per environment. */
  readonly chosen: Readonly<Record<string, string>>;
  /** The id the app resolved and shows now, per environment (set by the active-workspace hook). */
  readonly resolved: Readonly<Record<string, string | undefined>>;
  readonly choose: (environmentId: string, workspaceId: string) => void;
  readonly setResolved: (environmentId: string, workspaceId: string | undefined) => void;
}

export const useAiosWorkspaceStore = create<AiosWorkspaceStore>((set, get) => ({
  chosen: readStored(),
  resolved: {},
  choose: (environmentId, workspaceId) => {
    const chosen = { ...get().chosen, [environmentId]: workspaceId };
    try {
      window.localStorage.setItem(ACTIVE_WORKSPACE_KEY, JSON.stringify(chosen));
    } catch {
      // Storage full or blocked: the choice still applies for this session.
    }
    set({ chosen, resolved: { ...get().resolved, [environmentId]: workspaceId } });
  },
  setResolved: (environmentId, workspaceId) => {
    if (get().resolved[environmentId] === workspaceId) return;
    set({ resolved: { ...get().resolved, [environmentId]: workspaceId } });
  },
}));

/** The active workspace id for card writes made outside React render (event handlers). */
export function activeWorkspaceId(environmentId: string | null): string | undefined {
  return environmentId === null
    ? undefined
    : useAiosWorkspaceStore.getState().resolved[environmentId];
}
