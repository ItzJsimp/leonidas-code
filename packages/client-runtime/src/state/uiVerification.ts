import type { OrchestrationV2TurnItem } from "@t3tools/contracts";

const UI_SOURCE = /(^|\/)(apps\/(web|desktop|mobile)|packages\/client-runtime)\//;
const UI_FILE = /\.(tsx|jsx|css)$/;

/** Changed screen-level files from one run, so the verification prompt names only what the user can see. */
export function uiChangedPaths(
  items: ReadonlyArray<OrchestrationV2TurnItem>,
  runId: string,
): ReadonlyArray<string> {
  const paths = new Set<string>();
  for (const item of items) {
    if (item.type !== "file_change" || item.runId !== runId) continue;
    const changed = item.changes?.map((change) => change.path) ?? [item.fileName];
    for (const path of changed) {
      const normalized = path.replaceAll("\\", "/");
      if (UI_SOURCE.test(normalized) && UI_FILE.test(normalized)) paths.add(normalized);
    }
  }
  return [...paths];
}

export function uiVerificationPrompt(paths: ReadonlyArray<string>): string {
  return [
    "Verify the UI changes from your last turn in the preview before you report back.",
    "Open each changed screen, check that it renders, and check the console for errors.",
    "Fix any defect you find, then check again until the screens are clean.",
    `Changed files: ${paths.join(", ")}`,
  ].join("\n");
}
