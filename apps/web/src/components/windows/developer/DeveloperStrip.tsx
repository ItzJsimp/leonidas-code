import { Link, useLocation } from "@tanstack/react-router";

import { isElectron } from "~/env";
import { cn } from "~/lib/utils";

import { activeDeveloperTab, DEVELOPER_TABS } from "./developerTabs";

// The design sets tab labels at 13 px, like RailWindow.
// oxlint-disable-next-line shadcn/no-arbitrary-values -- between the xs and sm tokens.
const TAB_TEXT = "text-[13px]";

/**
 * The Developer title and its three tabs in one row. Git and Pull requests are full pages with
 * their own routes, so each tab is a link; the page you are on shows the same strip.
 */
export function DeveloperStrip() {
  const pathname = useLocation({ select: (location) => location.pathname });
  const active = activeDeveloperTab(pathname);
  return (
    <div
      className={cn(
        "flex h-12 shrink-0 items-center gap-5 overflow-x-auto border-b border-border bg-background px-4 max-[727px]:pl-14",
        isElectron && "drag-region",
      )}
    >
      <h1 className="shrink-0 text-base font-semibold">Developer</h1>
      <nav
        aria-label="Developer sections"
        className="flex h-full gap-4 [-webkit-app-region:no-drag]"
      >
        {DEVELOPER_TABS.map((tab) => (
          <Link
            key={tab.id}
            to={tab.to as "/"}
            search={(tab.id === "terminals" ? { tab: "terminals" } : {}) as never}
            aria-current={tab.id === active ? "page" : undefined}
            className={cn(
              "-mb-px flex shrink-0 items-center rounded-sm border-b-2 whitespace-nowrap transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring motion-reduce:transition-none",
              TAB_TEXT,
              tab.id === active
                ? "border-foreground font-medium text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {tab.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
