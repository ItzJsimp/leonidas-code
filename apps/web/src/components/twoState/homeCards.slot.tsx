import { FinishSetupCard } from "../onboarding/setup/FinishSetupCard";
import { GoalProgressCard } from "../taskBoard/GoalProgressCard";
import { HomeExtraCards } from "../taskBoard/HomeExtraCards";
import { VoiceLogCard } from "../taskBoard/VoiceLogCard";
import { WorkspacePackWidgets } from "../taskBoard/WorkspacePackWidgets";
import { TeamView } from "../team/TeamView";
import { defineSlots } from "./slots";

/**
 * The built-in Command Center home cards, in their old page order. Value meter, Helpers, Laya and
 * Ponytail are off the home page: Helpers already has a Library tab, the others wait for a
 * Usage or Library home. Their components stay in `taskBoard/`.
 */
export const slots = defineSlots({
  ccHome: [
    { id: "finish-setup", order: 10, Component: FinishSetupCard },
    { id: "goal-progress", order: 20, Component: GoalProgressCard },
    { id: "workspace-pack", order: 40, Component: WorkspacePackWidgets },
    { id: "team", order: 45, Component: TeamView },
    { id: "home-extras", order: 50, Component: HomeExtraCards },
    { id: "voice-log", order: 100, Component: VoiceLogCard },
  ],
});
