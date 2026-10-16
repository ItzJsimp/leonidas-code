import { create } from "zustand";
import { persist } from "zustand/middleware";

interface SubagentAttachState {
  /** Attached subagent name per composer target, kept on this device across turns and restarts. */
  readonly attachedByTarget: Readonly<Record<string, string>>;
  readonly attach: (targetKey: string, name: string) => void;
  readonly detach: (targetKey: string) => void;
}

export const useSubagentAttachStore = create<SubagentAttachState>()(
  persist(
    (set) => ({
      attachedByTarget: {},
      attach: (targetKey, name) =>
        set((state) => ({ attachedByTarget: { ...state.attachedByTarget, [targetKey]: name } })),
      detach: (targetKey) =>
        set((state) => {
          const { [targetKey]: _removed, ...rest } = state.attachedByTarget;
          return { attachedByTarget: rest };
        }),
    }),
    { name: "leonidas:subagent-attach:v1" },
  ),
);

export const selectAttachedSubagent = (targetKey: string) => (state: SubagentAttachState) =>
  state.attachedByTarget[targetKey] ?? null;
