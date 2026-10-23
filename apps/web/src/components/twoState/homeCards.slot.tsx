import { FinishSetupCard } from "../onboarding/setup/FinishSetupCard";
import { WorkspacePackWidgets } from "../taskBoard/WorkspacePackWidgets";
import { TeamView } from "../team/TeamView";
import { defineSlots } from "./slots";

/**
 * The built-in Command Center home cards, in their old page order. Value meter, Helpers, Laya and
 * Ponytail are off the home page: Helpers already has a Library tab, the others wait for a
 * Usage or Library home. Goal progress is a widget now, and the Voice-log and Extra cards are off
 * too. Their components stay in `taskBoard/`.
 */
export const slots = defineSlots({
  ccHome: [
    { id: "finish-setup", order: 10, Component: FinishSetupCard },
    { id: "workspace-pack", order: 40, Component: WorkspacePackWidgets },
    { id: "team", order: 45, Component: TeamView },
  ],
});
