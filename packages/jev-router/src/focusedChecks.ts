import { JevClientProtocol } from "./typesafeClient.js";

export interface CheckPipelineResult {
  passed: boolean;
  stage: string;
  focusedTests: string[];
  totalTestsAvailable: number;
  outputMessage: string;
}

export async function pickTests(
  diff: string,
  testFiles: string[],
  client: JevClientProtocol,
  keep = 12,
): Promise<string[]> {
  if (!testFiles.length) return [];
  if (testFiles.length <= keep) return [...testFiles];

  const diffSnippet = diff.slice(0, 12000);

  const scored = await Promise.all(
    testFiles.map(async (path) => {
      const context = `DIFF:\n${diffSnippet}\n\nTEST FILE: ${path}`;
      const probs = await client.choice(context, "Could this change break tests in this file?", [
        "likely",
        "unlikely",
      ]);
      return { path, prob: probs["likely"] ?? 0 };
    }),
  );

  scored.sort((a, b) => b.prob - a.prob);
  return scored.slice(0, keep).map((s) => s.path);
}

export async function runStagedChecks(
  diff: string,
  testFiles: string[],
  client: JevClientProtocol,
  testRunner: (tests: string[]) => Promise<{ ok: boolean; message: string }>,
  lintRunner?: () => Promise<{ ok: boolean; message: string }>,
  keepFocused = 12,
): Promise<CheckPipelineResult> {
  // Stage 1: Quick static checks
  if (lintRunner) {
    const lintRes = await lintRunner();
    if (!lintRes.ok) {
      return {
        passed: false,
        stage: "typecheck_and_lint",
        focusedTests: [],
        totalTestsAvailable: testFiles.length,
        outputMessage: `Static check failed: ${lintRes.message}`,
      };
    }
  }

  // Pick focused tests
  const focused = await pickTests(diff, testFiles, client, keepFocused);

  // Stage 2: Focused tests
  if (focused.length) {
    const focusedRes = await testRunner(focused);
    if (!focusedRes.ok) {
      return {
        passed: false,
        stage: "focused_tests",
        focusedTests: focused,
        totalTestsAvailable: testFiles.length,
        outputMessage: `Focused tests failed: ${focusedRes.message}`,
      };
    }
  }

  // Stage 3: Full test suite before commit
  const fullRes = await testRunner(testFiles);
  if (!fullRes.ok) {
    return {
      passed: false,
      stage: "full_suite",
      focusedTests: focused,
      totalTestsAvailable: testFiles.length,
      outputMessage: `Full test suite failed: ${fullRes.message}`,
    };
  }

  return {
    passed: true,
    stage: "completed_all_stages",
    focusedTests: focused,
    totalTestsAvailable: testFiles.length,
    outputMessage: "All static checks, focused tests, and full test suite passed.",
  };
}
