import { createFileRoute } from "@tanstack/react-router";

import { ThreadsSettingsPanel } from "../components/settings/SettingsPanels";

function SettingsThreadsRoute() {
  return <ThreadsSettingsPanel />;
}

export const Route = createFileRoute("/_chat/settings/threads")({
  component: SettingsThreadsRoute,
});
