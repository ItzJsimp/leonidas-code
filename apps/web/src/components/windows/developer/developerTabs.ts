export interface DeveloperTab {
  readonly id: "git" | "pull-requests" | "terminals";
  readonly label: string;
  readonly to: "/git" | "/pull-requests" | "/developer";
}

export const DEVELOPER_TABS: readonly DeveloperTab[] = [
  { id: "git", label: "Git", to: "/git" },
  { id: "pull-requests", label: "Pull requests", to: "/pull-requests" },
  { id: "terminals", label: "Terminals", to: "/developer" },
];

/** The tab for the open page. The Terminals tab owns the Developer page itself. */
export function activeDeveloperTab(pathname: string): DeveloperTab["id"] {
  const match = DEVELOPER_TABS.find(
    (tab) => tab.id !== "terminals" && (pathname === tab.to || pathname.startsWith(`${tab.to}/`)),
  );
  return match?.id ?? "terminals";
}
