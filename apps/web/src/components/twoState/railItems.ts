export type RailTo =
  | "/command-center"
  | "/"
  | "/scribe"
  | "/inbox"
  | "/today"
  | "/tasks"
  | "/projects"
  | "/memory"
  | "/library"
  | "/marketing"
  | "/images"
  | "/team"
  | "/developer"
  | "/usage"
  | "/settings";

export interface RailItem {
  readonly id: string;
  readonly label: string;
  /** The name, a colon, and one plain line of what the icon opens. */
  readonly tooltip: string;
  readonly to: RailTo;
  /** Other pages that belong to this icon; each matches itself and the pages under it. */
  readonly alsoActiveOn?: readonly string[];
}

const item = (
  id: string,
  label: string,
  to: RailTo,
  line: string,
  alsoActiveOn?: readonly string[],
): RailItem => ({
  id,
  label,
  to,
  tooltip: `${label}: ${line}`,
  ...(alsoActiveOn ? { alsoActiveOn } : {}),
});

const under = (pathname: string, base: string) =>
  pathname === base || pathname.startsWith(`${base}/`);

const BEFORE_EXTRAS: readonly RailItem[] = [
  item("command-center", "Command Center", "/command-center", "your work and what needs you"),
  {
    ...item("chat", "Chat", "/", "talk with Leonidas"),
    tooltip: "Leonidas Chat: talk with Leonidas",
  },
  item("scribe", "Scribe", "/scribe", "talk and have it typed for you"),
  item("inbox", "Inbox", "/inbox", "everything that needs you or finished"),
  item("today", "Today", "/today", "your priorities, schedule and briefing"),
  item("tasks", "Tasks", "/tasks", "what to do and what is in progress"),
  item("projects", "Projects", "/projects", "the projects you work on"),
  item("memory", "Memory", "/memory", "what Leonidas knows and remembers", ["/brain"]),
  item("library", "Library", "/library", "skills, helpers, reply styles and rules"),
  item("content", "Content", "/marketing", "posts and campaigns"),
  item("images", "Images", "/images", "make and keep pictures"),
];
const TEAM = item("team", "Team", "/team", "members, roles and areas");
const DEVELOPER = item("developer", "Developer", "/developer", "Git, pull requests and terminals", [
  "/git",
  "/pull-requests",
]);
const BOTTOM: readonly RailItem[] = [
  item("usage", "Usage", "/usage", "how much of your plan you have used"),
  item("settings", "Settings", "/settings", "change how Leonidas works", ["/system-care"]),
];

/** The rail icons. Team shows for a business workspace and Developer for a builder. */
export function railItems(input: { readonly business: boolean; readonly builder: boolean }) {
  return {
    main: [
      ...BEFORE_EXTRAS,
      ...(input.business ? [TEAM] : []),
      ...(input.builder ? [DEVELOPER] : []),
    ],
    bottom: BOTTOM,
  };
}

/** The icon that shows as the current page. Every chat page belongs to the Chat icon. */
export function activeRailId(pathname: string, onChat: boolean): string | null {
  if (onChat || pathname === "/") return "chat";
  const all = railItems({ business: true, builder: true });
  const match = [...all.main, ...all.bottom].find(
    (entry) =>
      (entry.to !== "/" && under(pathname, entry.to)) ||
      entry.alsoActiveOn?.some((base) => under(pathname, base)) === true,
  );
  return match?.id ?? null;
}
