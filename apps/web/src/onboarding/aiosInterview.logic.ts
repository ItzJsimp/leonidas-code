/**
 * The AIOS interview: one name to type and chips for the rest, then plain files built from the answers
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

export type InterviewQuestionKind = "text" | "single" | "multi";

export interface InterviewQuestion {
  readonly id: InterviewQuestionId;
  readonly label: string;
  readonly hint: string;
  readonly required: boolean;
  /** `text` is typed; `single` and `multi` are chips, one or many. */
  readonly kind: InterviewQuestionKind;
  readonly choices?: readonly string[];
  /** Chips that start selected, so a user who changes nothing still gets a sound AIOS. */
  readonly defaults?: readonly string[];
}

/** Every new identity file gets this style until the user asks for another one in chat. */
export const DEFAULT_ANSWER_STYLE = "Short and direct";

export const INTERVIEW_QUESTIONS: readonly InterviewQuestion[] = [
  {
    id: "name",
    label: "What should the AI call you?",
    hint: "A first name or nickname.",
    required: true,
    kind: "text",
  },
  {
    id: "work",
    label: "What best describes you?",
    hint: "Pick all that fit.",
    required: false,
    kind: "multi",
    choices: [
      "I run a business",
      "I create content",
      "I study",
      "I work a job",
      "I freelance",
      "I build software",
    ],
  },
  {
    id: "goal",
    label: "What do you want most from your AI?",
    hint: "Pick all that fit.",
    required: false,
    kind: "multi",
    choices: [
      "Get more done each day",
      "Write and edit",
      "Build and fix code",
      "Learn new things",
      "Plan and organise",
      "Research",
    ],
  },
  {
    id: "style",
    label: "How should answers look?",
    hint: "Pick one.",
    required: false,
    kind: "single",
    choices: ["Short and direct", "Step by step with reasons", "Detailed and thorough"],
    defaults: [DEFAULT_ANSWER_STYLE],
  },
  {
    id: "tools",
    label: "Which tools do you use every day?",
    hint: "Pick all that fit.",
    required: false,
    kind: "multi",
    choices: [
      "Chat and email",
      "Spreadsheets",
      "A code editor",
      "Design apps",
      "Video and audio",
      "Notes and docs",
    ],
  },
  {
    id: "avoid",
    label: "What should the AI never do without asking?",
    hint: "Pick all that fit.",
    required: false,
    kind: "multi",
    choices: [
      "Delete files",
      "Spend money",
      "Send messages for me",
      "Change things outside my folders",
    ],
    defaults: ["Delete files", "Spend money", "Send messages for me"],
  },
  {
    id: "rhythm",
    label: "When do you work best?",
    hint: "Pick one.",
    required: false,
    kind: "single",
    choices: ["Morning", "Afternoon", "Evening or night", "It changes"],
  },
  {
    id: "projects",
    label: "Name a project to start with",
    hint: "Optional. One short line.",
    required: false,
    kind: "text",
  },
];

/** The answers a user has before touching anything: the chips marked as defaults. */
/**
 * The 4 quick questions on the first-run screen. The rest wait for the first chat. The answer
 * style is not asked: it starts as "Short and direct" and changes in chat.
 */
export const QUICK_QUESTION_IDS: readonly InterviewQuestionId[] = [
  "work",
  "goal",
  "tools",
  "avoid",
];

/** Answered quick questions plus the default answer style, so 4 answers fill the meter. */
export function quickAnswerCount(answers: InterviewAnswers): number {
  return QUICK_QUESTION_IDS.filter((id) => cleanAnswer(answers[id] ?? "").length > 0).length + 1;
}

export function defaultAnswers(): InterviewAnswers {
  const out: Partial<Record<InterviewQuestionId, string>> = {};
  for (const question of INTERVIEW_QUESTIONS) {
    if (question.defaults?.length) out[question.id] = answerFromChoices(question.defaults);
  }
  return out;
}

/** One chip is plain text; several become a bullet list in the file. */
export function answerFromChoices(chosen: readonly string[]): string {
  if (chosen.length <= 1) return chosen[0] ?? "";
  return chosen.map((choice) => `- ${choice}`).join("\n");
}

/** The chips an answer string stands for, in the order of the question's choices. */
export function choicesFromAnswer(question: InterviewQuestion, answer: string): readonly string[] {
  const text = cleanAnswer(answer);
  return (question.choices ?? []).filter((choice) => text.includes(choice));
}

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

function identityFile(answers: InterviewAnswers, aiName: string | undefined): string {
  const name = cleanAnswer(answers.name ?? "") || "the user";
  const ai = cleanAnswer(aiName ?? "");
  return [
    `# ${name}`,
    "",
    "Your AI reads this file at the start of every session. Edit it any time.",
    "",
    ...(ai ? [`Your AI is called ${ai}.`, ""] : []),
    ...section("Who I am", answers.work),
    ...section("Main goal", answers.goal),
    ...section("How to answer me", answers.style || DEFAULT_ANSWER_STYLE),
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
export function buildAiosFiles(answers: InterviewAnswers, aiName?: string): readonly PlannedFile[] {
  const seen = new Set<string>();
  const projects: PlannedFile[] = [];
  for (const line of projectLines(answers.projects)) {
    const file = projectFile(line);
    if (seen.has(file.relativePath)) continue;
    seen.add(file.relativePath);
    projects.push(file);
  }
  return [
    { relativePath: "CLAUDE.md", contents: identityFile(answers, aiName) },
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
