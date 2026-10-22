import { FinishSetupCard } from "../onboarding/setup/FinishSetupCard";
import { SubagentStudio } from "../subagents/SubagentStudio";
import { AiosHomeCard } from "../taskBoard/AiosHomeCard";
import { DirectionSection } from "../taskBoard/DirectionSection";
import { HomeExtraCards } from "../taskBoard/HomeExtraCards";
import { LayaMonitorCard } from "../taskBoard/LayaMonitorCard";
import { PonytailCard } from "../taskBoard/PonytailCard";
import { ValueMeterCard } from "../taskBoard/ValueMeterCard";
import { VoiceLogCard } from "../taskBoard/VoiceLogCard";
import { WorkspacePackWidgets } from "../taskBoard/WorkspacePackWidgets";
import { TeamView } from "../team/TeamView";
import { defineSlots } from "./slots";

/** The built-in Command Center home cards, in their old page order. */
export const slots = defineSlots({
  ccHome: [
    { id: "finish-setup", order: 10, Component: FinishSetupCard },
    { id: "direction", order: 20, Component: DirectionSection },
    { id: "aios-home", order: 30, Component: AiosHomeCard },
    { id: "workspace-pack", order: 40, Component: WorkspacePackWidgets },
    { id: "team", order: 45, Component: TeamView },
    { id: "home-extras", order: 50, Component: HomeExtraCards },
    { id: "laya-monitor", order: 60, Component: LayaMonitorCard },
    { id: "ponytail", order: 70, Component: PonytailCard },
    { id: "subagent-studio", order: 80, Component: SubagentStudio },
    { id: "value-meter", order: 90, Component: ValueMeterCard },
    { id: "voice-log", order: 100, Component: VoiceLogCard },
  ],
});
