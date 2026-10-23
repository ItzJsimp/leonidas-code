import { useLocation, useNavigate } from "@tanstack/react-router";

import { WindowHeader } from "../../twoState/WindowHeader";
import { activeDeveloperTab, DEVELOPER_TABS } from "./developerTabs";

/**
 * The Developer title and its three tabs. Git and Pull requests are full pages with their own
 * routes, so picking a tab goes to that route; the page you are on shows the same header.
 */
export function DeveloperStrip() {
  const navigate = useNavigate();
  const pathname = useLocation({ select: (location) => location.pathname });
  return (
    <WindowHeader
      title="Developer"
      tabs={DEVELOPER_TABS}
      active={activeDeveloperTab(pathname)}
      onSelect={(id) => {
        const tab = DEVELOPER_TABS.find((entry) => entry.id === id);
        if (!tab) return;
        void navigate({
          to: tab.to,
          search: (tab.id === "terminals" ? { tab: "terminals" } : {}) as never,
        });
      }}
    />
  );
}
