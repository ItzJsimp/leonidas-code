import { createFileRoute } from "@tanstack/react-router";

import { ChatSettingsPanel } from "../components/settings/SettingsPanels";

function SettingsChatRoute() {
  return <ChatSettingsPanel />;
}

export const Route = createFileRoute("/_chat/settings/chat")({
  component: SettingsChatRoute,
});
