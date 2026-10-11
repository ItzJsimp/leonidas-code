import type { OrchestrationV2TurnItem } from "@t3tools/contracts";
import { describe, expect, it } from "vite-plus/test";

import { uiChangedPaths, uiVerificationPrompt } from "./uiVerification";

const fileChange = (runId: string, paths: ReadonlyArray<string>): OrchestrationV2TurnItem =>
  ({
    type: "file_change",
    runId,
    fileName: paths[0] ?? "unknown",
    changes: paths.map((path) => ({ operation: "update", path })),
  }) as unknown as OrchestrationV2TurnItem;

describe("uiChangedPaths", () => {
  it("keeps screen files from the given run and drops server and other-run changes", () => {
    const items = [
      fileChange("run-1", [
        "apps/web/src/components/chat/UsageLimitRecoveryBanner.tsx",
        "apps/server/src/provider/claudeUsageLimits.ts",
        "apps/web/src/index.css",
      ]),
      fileChange("run-2", ["apps/web/src/components/ChatView.tsx"]),
    ];

    expect(uiChangedPaths(items, "run-1")).toEqual([
      "apps/web/src/components/chat/UsageLimitRecoveryBanner.tsx",
      "apps/web/src/index.css",
    ]);
  });

  it("normalizes Windows separators and de-duplicates repeated paths", () => {
    const items = [
      fileChange("run-1", ["apps\\desktop\\src\\main.tsx", "apps/desktop/src/main.tsx"]),
    ];

    expect(uiChangedPaths(items, "run-1")).toEqual(["apps/desktop/src/main.tsx"]);
  });

  it("ignores non-file items", () => {
    const items = [
      {
        type: "command_execution",
        runId: "run-1",
        title: "pnpm test",
      } as unknown as OrchestrationV2TurnItem,
    ];

    expect(uiChangedPaths(items, "run-1")).toEqual([]);
  });
});

describe("uiVerificationPrompt", () => {
  it("asks for an in-preview check and lists the changed files", () => {
    const prompt = uiVerificationPrompt(["apps/web/src/components/ChatView.tsx"]);

    expect(prompt).toContain("Verify the UI changes from your last turn in the preview");
    expect(prompt).toContain("Changed files: apps/web/src/components/ChatView.tsx");
  });
});
