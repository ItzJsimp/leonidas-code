// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { EnvironmentId, type ScribeGoals, type ScribeInsights } from "@t3tools/contracts";
import { afterEach, beforeEach, expect, it, vi } from "vite-plus/test";

const mocks = vi.hoisted(() => ({
  result: { data: null as unknown, error: null as unknown, refresh: vi.fn() },
}));
vi.mock("~/state/query", () => ({ useEnvironmentQuery: () => mocks.result }));
vi.mock("~/state/scribe", () => ({
  scribeGoalsQuery: () => null,
  scribeInsightsQuery: () => null,
}));
import { ScribeGoalsTab } from "./ScribeGoalsTab";
import { ScribeInsightsTab } from "./ScribeInsightsTab";
import { INITIAL_SCRIBE_LIVE } from "./scribeLive.logic";

const props = { environmentId: EnvironmentId.make("env-1"), live: INITIAL_SCRIBE_LIVE };

const goals = (over: Partial<ScribeGoals> = {}): ScribeGoals => ({
  xp: 98_420,
  level: 31,
  rank: "Flow State",
  levelFloor: 96_075,
  levelCeil: 102_255,
  levelFrac: 0.379,
  nextRank: { level: 40, name: "Voice Architect" },
  today: {
    day: "2026-10-29",
    words: 2140,
    goal: 2500,
    deep: 4,
    deepGoal: 6,
    xp: 380,
    dictations: 31,
  },
  quests: [
    {
      id: "burst",
      title: "Flow burst",
      desc: "Dictate 5 times in 10 minutes",
      have: 5,
      need: 5,
      done: true,
      xp: 150,
    },
    {
      id: "apps",
      title: "App hopper",
      desc: "Dictate into 3 different apps",
      have: 2,
      need: 3,
      done: false,
      xp: 150,
    },
  ],
  questsDone: 1,
  streak: 12,
  bestStreak: 19,
  depth7d: 0,
  depthPrev: 0,
  metrics: {
    dictations: 9214,
    words: 412_880,
    longestPrompt: 412,
    bestStreak: 19,
    bestDay: 7260,
    agentApps: 6,
    deepPrompts: 377,
    sweeps: 1,
  },
  achievements: [
    {
      id: "first",
      name: "First Words",
      how: "Finish your first dictation",
      glyph: "mic",
      key: "dictations",
      have: 9214,
      need: 1,
      unlocked: true,
    },
    {
      id: "mono",
      name: "The Monologue",
      how: "Send a message of 750+ words",
      glyph: "volume",
      key: "longestPrompt",
      have: 412,
      need: 750,
      unlocked: false,
    },
  ],
  truncated: false,
  ...over,
});

const insights = (over: Partial<ScribeInsights> = {}): ScribeInsights => ({
  words: 412_880,
  transcripts: 9214,
  daysActive: 96,
  firstDay: "2026-07-20",
  lastDay: "2026-10-29",
  todayWords: 2140,
  todayTranscripts: 31,
  streakDays: 12,
  weekAvgWords: 3015,
  weekly: {
    words: 21_105,
    prevWords: 17_880,
    transcripts: 214,
    prevTranscripts: 196,
    p50: 1400,
    prevP50: 1600,
    topApp: "Claude",
    days: [
      { day: "2026-10-23", words: 3410 },
      { day: "2026-10-24", words: 4120 },
      { day: "2026-10-25", words: 0 },
    ],
  },
  latencySamples: 9214,
  p50: 1400,
  p90: 3100,
  sttP50: 620,
  polishP50: 710,
  sttShare: 46,
  polishShare: 54,
  byDay: {},
  byMode: [],
  byApp: [
    { key: "Claude", count: 3102 },
    { key: "WindowsTerminal-Preview (Administrator)", count: 88 },
  ],
  truncated: false,
  ...over,
});

let root: Root;
let container: HTMLDivElement;
beforeEach(() => {
  vi.clearAllMocks();
  mocks.result = { data: null, error: null, refresh: vi.fn() };
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});

const draw = async (node: React.ReactElement) => act(async () => root.render(node));

it("shows rank, level, today, quests and achievements on the Goals tab", async () => {
  mocks.result.data = goals();
  await draw(<ScribeGoalsTab {...props} />);
  const text = container.textContent ?? "";
  expect(text).toContain("Flow State");
  expect(text).toContain("Level 31 · 98,420 XP");
  expect(text).toContain("3,835 XP to level 32");
  expect(text).toContain("Voice Architect at level 40");
  expect(text).toContain("2,140 of 2,500");
  expect(text).toContain("12 days · best 19");
  expect(text).toContain("1 of 2 done");
  expect(text).toContain("1 of 2 unlocked");
  expect(text).toContain("412 of 750");
  expect(text).toContain("Unlocked");
  expect(text).toContain("100 or more words");
  // Only the level bar is read aloud. Every other bar repeats text beside it.
  expect(container.querySelectorAll("[role=progressbar]")).toHaveLength(1);
});

it("keeps every Today row a valid dt and dd pair", async () => {
  mocks.result.data = goals();
  await draw(<ScribeGoalsTab {...props} />);
  const dl = container.querySelector("dl");
  for (const row of dl?.children ?? []) {
    expect([...row.children].map((child) => child.tagName)).toEqual(["DT", "DD"]);
  }
});

it("shows 6 achievements on a phone until Show all is pressed", async () => {
  const many = Array.from({ length: 8 }, (_, i) => ({ ...goals().achievements[1]!, id: `a${i}` }));
  mocks.result.data = goals({ achievements: many });
  await draw(<ScribeGoalsTab {...props} />);
  const hidden = () => container.querySelectorAll("li.max-sm\\:hidden").length;
  expect(hidden()).toBe(2);
  const button = [...container.querySelectorAll("button")].find((b) =>
    b.textContent?.startsWith("Show all"),
  );
  expect(button?.getAttribute("aria-expanded")).toBe("false");
  await act(async () => button?.click());
  expect(hidden()).toBe(0);
  expect(button?.getAttribute("aria-expanded")).toBe("true");
  expect(button?.textContent).toBe("Show fewer");
});

it("refetches once when a new dictation is saved", async () => {
  mocks.result.data = goals();
  // Its own environment, so the remembered newest id does not leak into other tests.
  const own = { ...props, environmentId: EnvironmentId.make("env-refresh") };
  const item = { id: "h1" } as (typeof INITIAL_SCRIBE_LIVE.saved)[number];
  await draw(<ScribeGoalsTab {...own} />);
  expect(mocks.result.refresh).not.toHaveBeenCalled();
  await draw(<ScribeGoalsTab {...own} live={{ ...INITIAL_SCRIBE_LIVE, saved: [item] }} />);
  await draw(<ScribeGoalsTab {...own} live={{ ...INITIAL_SCRIBE_LIVE, saved: [item] }} />);
  expect(mocks.result.refresh).toHaveBeenCalledTimes(1);
});

it("asks a new user to dictate and hides quests on the Goals tab", async () => {
  mocks.result.data = goals({
    metrics: { ...goals().metrics, dictations: 0 },
    xp: 0,
    level: 1,
    rank: "Keyboard Hostage",
  });
  await draw(<ScribeGoalsTab {...props} />);
  const text = container.textContent ?? "";
  expect(text).toContain("Keyboard Hostage");
  expect(text).toContain("Say something to earn your first XP.");
  expect(text).not.toContain("Daily quests");
});

it("shows no bar for an achievement with no progress yet", async () => {
  const zero = { ...goals().achievements[1]!, have: 0 };
  mocks.result.data = goals({ achievements: [zero] });
  await draw(<ScribeGoalsTab {...props} />);
  const text = container.textContent ?? "";
  expect(text).not.toContain("0 of 750");
  expect(text).toContain("Locked");
});

it("shows the headline, figures, day bars and apps on the Insights tab", async () => {
  mocks.result.data = insights();
  await draw(<ScribeInsightsTab {...props} />);
  const text = container.textContent ?? "";
  expect(text).toContain(
    "This week you spoke 21,105 words, 18% more than last week, mostly in Claude.",
  );
  expect(text).toContain("1.4 s");
  expect(text).toContain("0.2 s faster");
  expect(text).toContain("96 days since 20 Jul");
  expect(text).toContain("Hearing 0.6 s");
  expect(text).toContain("Hearing turns your speech into text.");
  const days = container.querySelectorAll("ul[aria-label='Words per day this week'] li");
  expect(days.length).toBe(3);
  // The day is read before its value.
  expect(days[0]?.textContent).toBe("Fri3,410");
  expect(text).toContain("WindowsTerminal-Preview (Administrator)");
});

it("says there is nothing to chart before the first dictation", async () => {
  mocks.result.data = insights({ words: 0, transcripts: 0 });
  await draw(<ScribeInsightsTab {...props} />);
  expect(container.textContent).toContain("Nothing to chart yet.");
});

it("offers a retry when the numbers fail to load", async () => {
  mocks.result.error = new Error("offline");
  await draw(<ScribeGoalsTab {...props} />);
  expect(container.querySelector("[role=alert]")).not.toBeNull();
  const button = [...container.querySelectorAll("button")].find(
    (b) => b.textContent === "Try again",
  );
  await act(async () => button?.click());
  expect(mocks.result.refresh).toHaveBeenCalledTimes(1);
});
