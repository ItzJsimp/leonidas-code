/** Pure state and reporting for the new-user onboarding simulation. */

export type SimPersona = "fresh" | "veteran";
export type SimStep = "welcome" | "connect" | "agents" | "skills" | "import" | "aios";

export const SIM_STEPS: readonly SimStep[] = [
  "welcome",
  "connect",
  "agents",
  "skills",
  "import",
  "aios",
];
export const SIM_STEP_LABELS: Readonly<Record<SimStep, string>> = {
  welcome: "Welcome",
  connect: "Connect",
  agents: "AI",
  aios: "AIOS",
  skills: "Skills",
  import: "Projects",
};

export const PERSONA_LABELS: Readonly<Record<SimPersona, string>> = {
  fresh: "Brand-new computer: no AI installed, no projects",
  veteran: "Already uses Claude Code and Codex, with projects",
};

export interface SimClick {
  readonly step: SimStep;
  readonly label: string;
  readonly at: number;
}
export interface SimNote {
  readonly step: SimStep;
  readonly text: string;
  readonly at: number;
  readonly clicksSoFar: number;
}
export interface SimExternal {
  readonly step: SimStep;
  readonly label: string;
}

export interface SimRun {
  readonly persona: SimPersona;
  readonly startedAt: number;
  readonly finishedAt: number | null;
  readonly step: SimStep;
  /** Time of the last click or key; active time only counts gaps under IDLE_CAP_MS. */
  readonly lastAt: number;
  readonly stepMs: Readonly<Partial<Record<SimStep, number>>>;
  readonly clicks: readonly SimClick[];
  readonly keys: Readonly<Partial<Record<SimStep, number>>>;
  readonly notes: readonly SimNote[];
  readonly external: readonly SimExternal[];
  /** Where the run ended when the wizard hands off to a real chat instead of Projects. */
  readonly endedAt: string | null;
}

export function startRun(persona: SimPersona, now: number): SimRun {
  return {
    persona,
    startedAt: now,
    finishedAt: null,
    step: "welcome",
    lastAt: now,
    stepMs: {},
    clicks: [],
    keys: {},
    notes: [],
    external: [],
    endedAt: null,
  };
}

export function moveToStep(run: SimRun, step: SimStep): SimRun {
  return step === run.step ? run : { ...run, step };
}

/** Gaps longer than this are the tester thinking or talking, not the new user working. */
const IDLE_CAP_MS = 8_000;

function withActivity(run: SimRun, now: number): SimRun {
  const gap = Math.min(Math.max(now - run.lastAt, 0), IDLE_CAP_MS);
  return {
    ...run,
    lastAt: now,
    stepMs: { ...run.stepMs, [run.step]: (run.stepMs[run.step] ?? 0) + gap },
  };
}

export function recordClick(run: SimRun, label: string, now: number): SimRun {
  const active = withActivity(run, now);
  return { ...active, clicks: [...active.clicks, { step: run.step, label, at: now }] };
}

export function recordKey(run: SimRun, now: number): SimRun {
  const active = withActivity(run, now);
  return { ...active, keys: { ...active.keys, [run.step]: (run.keys[run.step] ?? 0) + 1 } };
}

export function finishRun(run: SimRun, now: number, endedAt: string | null): SimRun {
  return { ...withActivity(run, now), finishedAt: now, endedAt };
}

const INTERACTIVE_SELECTOR =
  'button,a[href],label,input,textarea,select,summary,[role="button"],[role="tab"],[role="checkbox"],[role="switch"],[role="menuitem"]';
const IGNORED_SELECTOR = "[data-sim-hud],[data-sim-control]";

/** Names the control a pointer press landed on, or null when it was not a required click. */
export function describeClickTarget(target: EventTarget | null): string | null {
  if (!(target instanceof Element)) return null;
  if (target.closest(IGNORED_SELECTOR)) return null;
  const control = target.closest(INTERACTIVE_SELECTOR);
  if (!control || control.matches(":disabled,[aria-disabled='true']")) return null;
  const readable = (element: Element) =>
    ((element as HTMLElement).innerText ?? element.textContent ?? "").replace(/\s+/g, " ").trim();
  const text = control.getAttribute("aria-label") ?? readable(control);
  const wrapped = text || (control.closest("label") ? readable(control.closest("label")!) : "");
  const fallback = control.getAttribute("placeholder") ?? control.tagName.toLowerCase();
  return (wrapped || fallback).slice(0, 48);
}

/** Typing and Enter count as effort; navigation and shortcuts do not. */
export function isCountedKey(event: { key: string; ctrlKey: boolean; metaKey: boolean }): boolean {
  if (event.ctrlKey || event.metaKey) return false;
  return event.key.length === 1 || event.key === "Enter" || event.key === "Backspace";
}

export function totalKeys(run: SimRun): number {
  return Object.values(run.keys).reduce((sum, count) => sum + (count ?? 0), 0);
}

export function clicksInStep(run: SimRun, step: SimStep): number {
  return run.clicks.filter((click) => click.step === step).length;
}

const seconds = (ms: number): string => `${Math.round(ms / 1000)}s`;

export function buildSimReport(run: SimRun): string {
  const rows = SIM_STEPS.map(
    (step) =>
      `| ${SIM_STEP_LABELS[step]} | ${clicksInStep(run, step)} | ${run.keys[step] ?? 0} | ${seconds(run.stepMs[step] ?? 0)} |`,
  );
  const activeMs = Object.values(run.stepMs).reduce((sum, ms) => sum + (ms ?? 0), 0);
  const path = run.clicks.map(
    (click, index) => `${index + 1}. [${SIM_STEP_LABELS[click.step]}] ${click.label}`,
  );
  const lines = [
    "# New-user onboarding simulation",
    "",
    `Persona: ${PERSONA_LABELS[run.persona]}`,
    `Ended: ${run.endedAt ?? "finished every step"}`,
    `**${run.clicks.length} clicks, ${totalKeys(run)} keystrokes, ${seconds(activeMs)} of active use (pauses over 8s not counted).**`,
    "",
    "| Step | Clicks | Keystrokes | Active time |",
    "| --- | --- | --- | --- |",
    ...rows,
  ];
  if (run.external.length > 0) {
    lines.push(
      "",
      "## Outside the app (not counted)",
      ...run.external.map((e) => `- [${SIM_STEP_LABELS[e.step]}] ${e.label}`),
    );
  }
  if (run.notes.length > 0) {
    lines.push(
      "",
      "## Improvements noted",
      ...run.notes.map(
        (note) => `- [${SIM_STEP_LABELS[note.step]}, after click ${note.clicksSoFar}] ${note.text}`,
      ),
    );
  }
  lines.push("", "## Click path", ...path);
  return lines.join("\n");
}

export interface SimHistoryEntry {
  readonly finishedAt: number;
  readonly persona: SimPersona;
  readonly clicks: number;
  readonly keys: number;
  readonly report: string;
}

const HISTORY_LIMIT = 10;

export function addToHistory(
  history: readonly SimHistoryEntry[],
  run: SimRun,
): readonly SimHistoryEntry[] {
  if (run.finishedAt === null || history.some((entry) => entry.finishedAt === run.finishedAt)) {
    return history;
  }
  const entry: SimHistoryEntry = {
    finishedAt: run.finishedAt,
    persona: run.persona,
    clicks: run.clicks.length,
    keys: totalKeys(run),
    report: buildSimReport(run),
  };
  return [entry, ...history].slice(0, HISTORY_LIMIT);
}

export function reportFileName(entry: Pick<SimHistoryEntry, "finishedAt" | "persona">): string {
  const d = new Date(entry.finishedAt);
  const pad = (n: number) => String(n).padStart(2, "0");
  const stamp = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}-${pad(d.getHours())}-${pad(d.getMinutes())}`;
  return `onboarding-sim-${stamp}-${entry.persona}.md`;
}
