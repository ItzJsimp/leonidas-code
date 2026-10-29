import { createFileRoute } from "@tanstack/react-router";

import { AboutSettingsPanel } from "../components/settings/SettingsPanels";

function SettingsAboutRoute() {
  return <AboutSettingsPanel />;
}

export const Route = createFileRoute("/_chat/settings/about")({
  component: SettingsAboutRoute,
});
