/**
 * Where each shippable feature lives in the app. A release-note bullet ends with `{tour:<id>}`
 * to link itself to one of these; the update popup then offers "Show me where" and the spotlight
 * walks the steps. Shipping a user-visible `feat:` means adding or updating a target here.
 */

export type TourRoute = "/" | "/command-center" | "/tasks" | "/usage" | "/settings";

export interface TourStep {
  readonly title: string;
  readonly body: string;
  /** Page to open before looking for the anchor. */
  readonly route?: TourRoute;
  /** Value of the `data-tour` attribute on the element to point at. Without one the card is centered. */
  readonly anchor?: string;
  /** Pre-fills a fresh chat with this prompt behind a "Try it now" button. */
  readonly tryPrompt?: string;
}

export interface TourTarget {
  readonly name: string;
  readonly steps: ReadonlyArray<TourStep>;
}

export const TOUR_TARGETS = {
  "saved-items": {
    name: "Prompts",
    steps: [
      {
        title: "Keep a prompt for later",
        body: "Use Save beside the composer to queue an unsent prompt. The arrow also saves notes or tasks. Open Prompts to edit, remove or delete a prompt, queue it in the open thread, launch it in a new thread, or schedule a one-time run.",
        route: "/",
        anchor: "saved-items",
        tryPrompt:
          "Save a note titled Saved items test with the text: Review my saved prompts before starting more work.",
      },
    ],
  },
  roadmap: {
    name: "Release roadmap",
    steps: [
      {
        title: "Plan the path to a release",
        body: "Open Roadmap to see each version milestone, its task briefs and release gate. Open a task to assign its version or explicitly send it to an agent.",
        route: "/tasks",
        anchor: "tasks-roadmap-tab",
      },
    ],
  },
  "next-action": {
    name: "Next action",
    steps: [
      {
        title: "Next action",
        body: 'This tab above the chat box fills it with "next action". Send it and the agent picks the best task from your task cards. You can also just type "what should I work on".',
        route: "/",
        anchor: "composer-next-action",
        tryPrompt: "next action",
      },
    ],
  },
  "command-center": {
    name: "Command Center",
    steps: [
      {
        title: "Command Center",
        body: "This sidebar button opens one page with every approval, question, limit and running job across your environments.",
        anchor: "sidebar-command-center",
      },
    ],
  },
  tasks: {
    name: "Tasks",
    steps: [
      {
        title: "Tasks for you and your agents",
        body: "Capture work in Inbox, plan Today and Upcoming, and organize tasks into projects. Open a task to set its date, complete it, or explicitly send it to an agent.",
        anchor: "sidebar-tasks",
      },
      {
        title: "Capture a task",
        body: "Type a task and press Enter. Add a due date to include it in your daily plan. Choose New task for details, priority, or a new project.",
        route: "/tasks",
        anchor: "tasks-quick-add",
      },
    ],
  },
  usage: {
    name: "Usage",
    steps: [
      {
        title: "Usage and limits",
        body: "See how much of each subscription you have used and when it resets.",
        anchor: "sidebar-usage",
      },
    ],
  },
  updates: {
    name: "Updates",
    steps: [
      {
        title: "Update history",
        body: "Every past release with its highlights. Open it any time to replay a walkthrough.",
        anchor: "sidebar-updates",
      },
    ],
  },
} as const satisfies Record<string, TourTarget>;

export type TourTargetId = keyof typeof TOUR_TARGETS;

const TOUR_MARKER = /\s*\{tour:([a-z0-9-]+)\}\s*$/;

function isTourTargetId(id: string): id is TourTargetId {
  return Object.hasOwn(TOUR_TARGETS, id);
}

/** Splits a release bullet into display text and its tour target; unknown ids are dropped, never shown. */
export function splitTourMarker(item: string): {
  readonly text: string;
  readonly targetId: TourTargetId | null;
} {
  const match = TOUR_MARKER.exec(item);
  if (!match) return { text: item, targetId: null };
  const id = match[1] ?? "";
  return { text: item.slice(0, match.index).trimEnd(), targetId: isTourTargetId(id) ? id : null };
}
