/**
 * The typed AIOS interview: eight short questions, then plain files built from the answers
 * with no AI call. The file plan is create-only: a file that already exists is never in it.
 */

export type InterviewQuestionId =
  | "name"
  | "work"
  | "goal"
  | "style"
  | "tools"
  | "avoid"
  | "rhythm"
  | "projects";

export interface InterviewQuestion {
  readonly id: InterviewQuestionId;
  readonly label: string;
  readonly hint: string;
  readonly required: boolean;
  readonly multiline: boolean;
}

export const INTERVIEW_QUESTIONS: readonly InterviewQuestion[] = [
  {
    id: "name",
    label: "What should the AI call you?",
    hint: "A first name or nickname.",
    required: true,
    multiline: false,
  },
  {
    id: "work",
    label: "What do you do or build?",
    hint: "One or two sentences. A job, a business, a hobby, a study.",
    required: true,
    multiline: true,
  },
  {
    id: "goal",
    label: "What is your main goal right now?",
    hint: "The one result you want most this month.",
    required: false,
    multiline: true,
  },
  {
    id: "style",
    label: "How do you like answers written?",
    hint: "For example: short and direct, or step by step with reasons.",
    required: false,
    multiline: true,
  },
  {
    id: "tools",
    label: "Which tools and apps do you use every day?",
    hint: "Editors, chat apps, spreadsheets. Any list is fine.",
    required: false,
    multiline: true,
  },
  {
    id: "avoid",
    label: "What should the AI never do?",
    hint: "Rules like: do not delete files, ask before you spend money.",
    required: false,
    multiline: true,
  },
  {
    id: "rhythm",
    label: "When do you work, and what slows you down?",
    hint: "Hours, energy, or habits the AI should plan around.",
    required: false,
    multiline: true,
  },
  {
    id: "projects",
    label: "Which projects should the AI know about?",
    hint: "One per line. Add a few words about each.",
    required: false,
    multiline: true,
  },
];

export type InterviewAnswers = Readonly<Partial<Record<InterviewQuestionId, string>>>;

export const MAX_ANSWER_LENGTH = 2000;

export function cleanAnswer(value: string): string {
  return value.replace(/\r\n/g, "\n").trim().slice(0, MAX_ANSWER_LENGTH);
}

/** The first required question that has no answer, or null when the interview can finish. */
export function firstMissingRequired(answers: InterviewAnswers): InterviewQuestion | null {
  return (
    INTERVIEW_QUESTIONS.find((q) => q.required && cleanAnswer(answers[q.id] ?? "").length === 0) ??
    null
  );
}

export function answeredCount(answers: InterviewAnswers): number {
  return INTERVIEW_QUESTIONS.filter((q) => cleanAnswer(answers[q.id] ?? "").length > 0).length;
}

export interface PlannedFile {
  readonly relativePath: string;
  readonly contents: string;
}

function section(title: string, body: string | undefined): string[] {
  const text = cleanAnswer(body ?? "");
  return text.length > 0 ? [`## ${title}`, "", text, ""] : [];
}

function projectLines(answer: string | undefined): readonly string[] {
  return cleanAnswer(answer ?? "")
    .split("\n")
    .map((line) => line.replace(/^[-*\s]+/, "").trim())
    .filter((line) => line.length > 0)
    .slice(0, 12);
}

function identityFile(answers: InterviewAnswers): string {
  const name = cleanAnswer(answers.name ?? "") || "the user";
  return [
    `# ${name}`,
    "",
    "Your AI reads this file at the start of every session. Edit it any time.",
    "",
    ...section("Who I am", answers.work),
    ...section("Main goal", answers.goal),
    ...section("How to answer me", answers.style),
    ...section("Tools I use", answers.tools),
    ...section("Never do this", answers.avoid),
    ...section("My rhythm", answers.rhythm),
    "## Memory",
    "",
    "Save lasting facts and corrections in `memory/`. Check there before you ask me again.",
    "",
  ].join("\n");
}

function agentsFile(): string {
  return [
    "# Agent rules",
    "",
    "Read [CLAUDE.md](./CLAUDE.md) first. It says who the user is and how to work with them.",
    "",
    "- Keep durable facts in `memory/`.",
    "- Track work as one card per task in `tasks/`.",
    "- Keep each project in its own folder in `projects/`.",
    "",
  ].join("\n");
}

function projectFile(line: string): PlannedFile {
  const slug =
    line
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "project";
  return {
    relativePath: `projects/${slug}/README.md`,
    contents: `# ${line}\n\nNotes and rules for this project go here.\n`,
  };
}

/** Every file the interview would write, before any check for files that already exist. */
export function buildAiosFiles(answers: InterviewAnswers): readonly PlannedFile[] {
  const seen = new Set<string>();
  const projects: PlannedFile[] = [];
  for (const line of projectLines(answers.projects)) {
    const file = projectFile(line);
    if (seen.has(file.relativePath)) continue;
    seen.add(file.relativePath);
    projects.push(file);
  }
  return [
    { relativePath: "CLAUDE.md", contents: identityFile(answers) },
    { relativePath: "AGENTS.md", contents: agentsFile() },
    {
      relativePath: "memory/README.md",
      contents: "# Memory\n\nOne short file per lasting fact or correction.\n",
    },
    {
      relativePath: "tasks/README.md",
      contents: "# Tasks\n\nOne card per task: a title, a scope and a way to check it is done.\n",
    },
    ...projects,
  ];
}

export interface CreatePlan {
  readonly toCreate: readonly PlannedFile[];
  readonly skipped: readonly string[];
}

/** Create-only: a path in `existing` is skipped, never overwritten. */
export function planCreateOnly(
  files: readonly PlannedFile[],
  existing: readonly string[],
): CreatePlan {
  const taken = new Set(existing.map((path) => path.replace(/\\/g, "/")));
  return {
    toCreate: files.filter((file) => !taken.has(file.relativePath)),
    skipped: files.filter((file) => taken.has(file.relativePath)).map((file) => file.relativePath),
  };
}
