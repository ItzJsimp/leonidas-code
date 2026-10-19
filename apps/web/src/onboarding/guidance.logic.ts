import * as Schema from "effect/Schema";

export const AI_LEVELS = [
  { id: "new", label: "New to AI", description: "I have not used an AI assistant before." },
  {
    id: "beginner",
    label: "Beginner",
    description: "I have tried AI and want help with the basics.",
  },
  {
    id: "comfortable",
    label: "Comfortable",
    description: "I use AI often and want to learn this app.",
  },
  { id: "builder", label: "Builder", description: "I build with AI and want advanced tips too." },
] as const;
export const AiLevelSchema = Schema.Literals(["new", "beginner", "comfortable", "builder"]);
export type AiLevel = typeof AiLevelSchema.Type;
export const decodeAiLevel = Schema.decodeUnknownSync(AiLevelSchema);
export const GuidanceActionSchema = Schema.Literals([
  "prompt_sent",
  "reply_stopped",
  "thread_created",
  "browser_opened",
  "approval_answered",
]);
export type GuidanceAction = typeof GuidanceActionSchema.Type;
const Count = Schema.Int.check(Schema.isBetween({ minimum: 0, maximum: 3 }));
export const GuidanceProfileSchema = Schema.Struct({
  level: AiLevelSchema,
  startedDay: Schema.String.check(Schema.isPattern(/^\d{4}-\d{2}-\d{2}$/)),
  active: Schema.Boolean,
  paused: Schema.Boolean,
  counts: Schema.Struct({
    prompt_sent: Count,
    reply_stopped: Count,
    thread_created: Count,
    browser_opened: Count,
    approval_answered: Count,
  }),
  completedDays: Schema.Array(
    Schema.Int.check(Schema.isBetween({ minimum: 0, maximum: 29 })),
  ).check(Schema.isMaxLength(30)),
  weeklyResults: Schema.Array(
    Schema.Struct({
      week: Schema.Int.check(Schema.isBetween({ minimum: 1, maximum: 4 })),
      score: Schema.Int.check(Schema.isBetween({ minimum: 0, maximum: 5 })),
    }),
  ).check(Schema.isMaxLength(4)),
});
export type GuidanceProfile = typeof GuidanceProfileSchema.Type;
export type GuidanceScreen = "chat" | "tasks" | "settings";
export interface GuidanceTip {
  id: string;
  action: GuidanceAction;
  screen: GuidanceScreen;
  title: string;
  text: string;
  advanced: boolean;
  introducedOn?: string;
}
export const GUIDANCE_TIPS: readonly GuidanceTip[] = [
  {
    id: "prompt",
    action: "prompt_sent",
    screen: "chat",
    title: "Ask for one result",
    text: "Say what you need, give useful details, and describe the result you want. Review the reply before using it.",
    advanced: false,
  },
  {
    id: "stop",
    action: "reply_stopped",
    screen: "chat",
    title: "You can stop a reply",
    text: "Press Stop when a reply takes the wrong direction. Then explain what the AI should change.",
    advanced: false,
  },
  {
    id: "thread",
    action: "thread_created",
    screen: "chat",
    title: "Keep topics in separate chats",
    text: "Start a new chat for a different task. Return to an existing chat when you want to continue its work.",
    advanced: false,
  },
  {
    id: "approval",
    action: "approval_answered",
    screen: "chat",
    title: "Read requests for permission",
    text: "Check the proposed action before you approve it. You can reject it and ask for a different approach.",
    advanced: false,
  },
  {
    id: "browser",
    action: "browser_opened",
    screen: "chat",
    title: "Check the result in Browser",
    text: "Open your work in the built-in Browser. Test the result and give the AI specific corrections.",
    advanced: true,
  },
];
export const WEEKLY_QUESTIONS = [
  {
    question: "What makes a useful request?",
    options: [
      "A clear result and useful details",
      "Only the words do it",
      "More words without a goal",
    ],
    correct: 0,
    explanation: "A clear result and relevant details help the AI act on your request.",
  },
  {
    question: "What should you do before using an AI answer?",
    options: [
      "Check the writing style only",
      "Check that it is correct for your task",
      "Ask the AI if it agrees with itself",
    ],
    correct: 1,
    explanation: "AI can make mistakes. Check important facts and test the result.",
  },
  {
    question: "A reply takes the wrong direction. What can you do?",
    options: [
      "Repeat the same request without changes",
      "Wait without correcting it",
      "Stop it and give a correction",
    ],
    correct: 2,
    explanation: "Stop ends the current reply. A correction helps the next attempt.",
  },
  {
    question: "When should you start a new chat?",
    options: [
      "When you start a different task",
      "After every sentence",
      "Only after restarting the app",
    ],
    correct: 0,
    explanation: "Separate tasks are easier to follow in separate chats.",
  },
  {
    question: "The app asks for permission. What should you do?",
    options: [
      "Approve all requests from a familiar AI",
      "Read the action and approve only if you want it",
      "Reject every request without reading it",
    ],
    correct: 1,
    explanation: "Review the proposed action. Keep passwords and keys out of chat.",
  },
] as const;

export function localDay(now: Date): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}
function dayNumber(day: string): number {
  const [year, month, date] = day.split("-").map(Number);
  return Date.UTC(year!, month! - 1, date!) / 86_400_000;
}
export function guidanceProfileKey(environmentId: string, folder: string): string {
  return `leonidas:guidance:${JSON.stringify([environmentId, folder.replaceAll("\\", "/").replace(/\/$/, "")])}`;
}
export function newGuidanceProfile(level: AiLevel, now: Date): GuidanceProfile {
  return {
    level,
    startedDay: localDay(now),
    active: true,
    paused: false,
    counts: {
      prompt_sent: 0,
      reply_stopped: 0,
      thread_created: 0,
      browser_opened: 0,
      approval_answered: 0,
    },
    completedDays: [],
    weeklyResults: [],
  };
}
export function guidanceDay(profile: GuidanceProfile, now: Date): number {
  return Math.max(0, dayNumber(localDay(now)) - dayNumber(profile.startedDay));
}
export function availableTips(
  profile: GuidanceProfile,
  screen: GuidanceScreen,
  now: Date,
): readonly GuidanceTip[] {
  if (!profile.active || profile.paused) return [];
  const day = guidanceDay(profile, now);
  return GUIDANCE_TIPS.filter(
    (tip) =>
      tip.screen === screen &&
      (!tip.advanced || profile.level === "builder") &&
      profile.counts[tip.action] < 3 &&
      (day < 30 || (tip.introducedOn !== undefined && tip.introducedOn > profile.startedDay)),
  );
}
export function dailyChallenge(profile: GuidanceProfile, now: Date): GuidanceTip | null {
  if (!profile.active || profile.paused || guidanceDay(profile, now) >= 30) return null;
  // Daily basics stay stable when the user changes level.
  const tips = GUIDANCE_TIPS.filter((tip) => !tip.advanced);
  return tips[guidanceDay(profile, now) % tips.length] ?? null;
}
export function recordGuidanceAction(
  profile: GuidanceProfile,
  action: GuidanceAction,
  now: Date,
): GuidanceProfile {
  if (!profile.active || profile.paused) return profile;
  const day = guidanceDay(profile, now);
  const challenge = dailyChallenge(profile, now);
  return {
    ...profile,
    counts: { ...profile.counts, [action]: Math.min(3, profile.counts[action] + 1) },
    completedDays:
      challenge?.action === action && !profile.completedDays.includes(day)
        ? [...profile.completedDays, day]
        : profile.completedDays,
  };
}
export function dueWeeklyCheck(profile: GuidanceProfile, now: Date): number | null {
  const day = guidanceDay(profile, now);
  if (!profile.active || profile.paused || day >= 30) return null;
  return (
    [1, 2, 3, 4].find(
      (week) =>
        week <= Math.floor((day + 1) / 7) &&
        !profile.weeklyResults.some((result) => result.week === week),
    ) ?? null
  );
}
export function completeWeeklyCheck(
  profile: GuidanceProfile,
  answers: readonly number[],
  now: Date,
): GuidanceProfile {
  const week = dueWeeklyCheck(profile, now);
  if (week === null) return profile;
  if (
    answers.length !== 5 ||
    WEEKLY_QUESTIONS.some((question, index) => {
      const answer = answers[index];
      return (
        typeof answer !== "number" ||
        !Number.isInteger(answer) ||
        answer < 0 ||
        answer >= question.options.length
      );
    })
  )
    throw new Error("Answer all five questions before saving this check.");
  return {
    ...profile,
    weeklyResults: [
      ...profile.weeklyResults,
      {
        week,
        score: answers.filter((answer, index) => answer === WEEKLY_QUESTIONS[index]!.correct)
          .length,
      },
    ],
  };
}
export function resetGuidance(profile: GuidanceProfile, now: Date): GuidanceProfile {
  return newGuidanceProfile(profile.level, now);
}
