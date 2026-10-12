import * as Schema from "effect/Schema";

/** What the user told the welcome step they build with Leonidas Code. */
export const LEONIDAS_GOALS_STORAGE_KEY = "leonidas:onboarding-goals";
export const LeonidasGoalsSchema = Schema.Array(Schema.String);

export interface LeonidasGoal {
  readonly id: string;
  readonly label: string;
  readonly hint: string;
}

export const LEONIDAS_GOALS: readonly LeonidasGoal[] = [
  { id: "web-apps", label: "Web apps", hint: "Dashboards, tools, SaaS" },
  { id: "websites", label: "Websites and landing pages", hint: "Sites for you or clients" },
  { id: "mobile-apps", label: "Mobile apps", hint: "iPhone and Android" },
  { id: "automation", label: "Automations and scripts", hint: "Save time on repeat work" },
  { id: "data", label: "Data and analysis", hint: "Spreadsheets, reports, charts" },
  { id: "agents", label: "AI agents and bots", hint: "Assistants that do things" },
  { id: "games", label: "Games", hint: "Prototypes to full builds" },
  { id: "design", label: "Design and UI polish", hint: "Make it look right" },
  { id: "fix-code", label: "Fixing and improving existing code", hint: "Bugs, cleanups, upgrades" },
  { id: "learning", label: "Learning to code", hint: "Understand while you build" },
];

/** Keeps stored picks that still exist, so a retired goal never breaks the step. */
export function normalizeGoalIds(stored: readonly string[]): readonly string[] {
  const known = new Set(LEONIDAS_GOALS.map((goal) => goal.id));
  return stored.filter((id) => known.has(id));
}

export function toggleGoal(selected: readonly string[], id: string): readonly string[] {
  return selected.includes(id) ? selected.filter((entry) => entry !== id) : [...selected, id];
}

/** Where the guided setup builds the AIOS; the server expands the leading ~. */
export const AIOS_FOLDER_STORAGE_KEY = "leonidas:aios-folder";
export const DEFAULT_AIOS_FOLDER = "~/AIOS";

export interface AiosPresetEntry {
  readonly path: string;
  readonly purpose: string;
}

/** Starter AIOS shape: identity, memory, tasks, projects and skills. */
export const AIOS_PRESET: readonly AiosPresetEntry[] = [
  {
    path: "CLAUDE.md",
    purpose: "Who you are and how the AI should work with you. Loaded every session.",
  },
  {
    path: "AGENTS.md",
    purpose: "The same rules for tools that read AGENTS.md instead (Codex and others).",
  },
  {
    path: "memory/",
    purpose: "Facts the AI keeps between sessions: your preferences and corrections.",
  },
  { path: "tasks/", purpose: "One card per task, so the AI can pick what to work on next." },
  { path: "projects/", purpose: "One folder per project, each with its own notes and rules." },
  {
    path: ".claude/skills/",
    purpose: "Reusable how-to instructions the AI loads when a task matches.",
  },
];

export function goalLabels(goalIds: readonly string[]): readonly string[] {
  return normalizeGoalIds(goalIds).flatMap((id) => {
    const goal = LEONIDAS_GOALS.find((entry) => entry.id === id);
    return goal ? [goal.label] : [];
  });
}

/** The prompt a user pastes into the AI they already use to build their AIOS. */
export function buildAiosSetupPrompt(
  goalIds: readonly string[],
  options: { readonly inCurrentFolder?: boolean } = {},
): string {
  const goals = goalLabels(goalIds);
  const tree = AIOS_PRESET.map((entry) => `- ${entry.path}: ${entry.purpose}`).join("\n");
  return [
    "Help me set up an AIOS (an AI operating system): a folder of plain files that tells my AI who I am, remembers what matters, and tracks my work, so every session starts with context.",
    goals.length > 0
      ? `I mainly use AI to work on: ${goals.join(", ")}.`
      : "I have not picked a main use yet, so keep the setup general.",
    options.inCurrentFolder
      ? "Create this structure in the current folder, which is already my AIOS folder:"
      : "Create this structure in a new folder (ask me where first):",
    tree,
    "Ask me a few short questions (my name, what I build, how I like answers written), then fill in CLAUDE.md and AGENTS.md from my answers. Keep each file short and plain.",
    options.inCurrentFolder
      ? "When done, list what you created in one line each."
      : "When done, list what you created and tell me how to open that folder in Leonidas Code.",
  ].join("\n\n");
}

/** Asks the user's own agent for skills beyond the bundled packs. */
export function buildSkillSuggestionPrompt(
  goalIds: readonly string[],
  installedSkillNames: readonly string[],
): string {
  const goals = goalLabels(goalIds);
  return [
    `Suggest and write 3 to 5 extra skills for me. I mainly use AI to work on: ${goals.length > 0 ? goals.join(", ") : "general coding"}.`,
    installedSkillNames.length > 0
      ? `These skills are already installed, so do not repeat them: ${installedSkillNames.join(", ")}.`
      : "No skills are installed yet.",
    "Look at this folder first so the skills fit how I work. A skill is a folder with a SKILL.md file: frontmatter with name and description, then short step-by-step instructions.",
    "Write each one to .claude/skills/<name>/SKILL.md and .agents/skills/<name>/SKILL.md, then list what you added in one line each.",
  ].join("\n\n");
}

export const AIOS_MANUAL_STEPS: readonly string[] = [
  "Create a new folder anywhere you keep projects, for example AIOS.",
  "Inside it, make the folders memory, tasks, projects and .claude/skills.",
  "Create CLAUDE.md and AGENTS.md. Write a few lines: your name, what you build, and how you want answers written.",
  "Open the folder in Leonidas Code as a project. Your AI now reads those files at the start of every session.",
];
