/**
 * Scores a generated agent prompt against the prompt-composer rubric (the checkable parts).
 * The skill lives in the AIOS, so the rules it enforces are encoded here and run in tests:
 * every System Care prompt must keep a stated goal, disclosed context pointers, numbered
 * read-only checks, a fixed output shape, binary done criteria, and an approval stop.
 */
export interface PromptAuditResult {
  readonly score: number;
  readonly failures: ReadonlyArray<string>;
}

// Phrases the model already obeys by default; deleting them changes nothing.
const NO_OPS = [/be thorough/i, /think (carefully|step by step)/i, /clean code/i, /make sure to/i];
const EM_DASH = String.fromCharCode(0x2014);

export function auditPrompt(prompt: string): PromptAuditResult {
  const checks: ReadonlyArray<readonly [name: string, ok: boolean, points: number]> = [
    ["states a goal on the first line", prompt.startsWith("Goal: "), 15],
    ["has a Context section with file pointers", /\nContext\n- .*AGENTS\.md/.test(prompt), 15],
    ["has numbered read-only checks", /\nChecks \(read-only[^\n]*\n1\. /.test(prompt), 15],
    ["defines the output shape", /\nOutput\n1\. [^\n]*\n2\. Table:/.test(prompt), 15],
    ["has binary done criteria", /\nDone when\n(- [^\n]+\n?){3}$/.test(prompt), 15],
    ["stops for approval before changes", /wait for my yes/.test(prompt), 10],
    ["states what must not change", /No file, setting or process was modified/.test(prompt), 5],
    ["has no no-op phrases", !NO_OPS.some((pattern) => pattern.test(prompt)), 5],
    [
      "has no em dash and no personal user path",
      !prompt.includes(EM_DASH) && !/C:\\Users\\/i.test(prompt),
      5,
    ],
  ];
  const failures = checks.filter(([, ok]) => !ok).map(([name]) => name);
  const score = checks.reduce((sum, [, ok, points]) => sum + (ok ? points : 0), 0);
  return { score, failures };
}
