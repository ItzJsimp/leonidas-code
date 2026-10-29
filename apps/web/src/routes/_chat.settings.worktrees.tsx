import { createFileRoute } from "@tanstack/react-router";

import { WorktreesSettingsPanel } from "../components/settings/SettingsPanels";

function SettingsWorktreesRoute() {
  return <WorktreesSettingsPanel />;
}

export const Route = createFileRoute("/_chat/settings/worktrees")({
  component: SettingsWorktreesRoute,
});
