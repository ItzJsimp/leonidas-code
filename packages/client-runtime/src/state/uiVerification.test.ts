import type { OrchestrationV2TurnItem } from "@t3tools/contracts";
import { describe, expect, it } from "vite-plus/test";

import { uiChangedPaths, uiVerificationPrompt } from "./uiVerification.ts";

const RUN_A = "run-a";
const RUN_B = "run-b";

function fileChange(
  runId: string,
  fileName: string,
  changes?: ReadonlyArray<{ readonly path: string }>,
): OrchestrationV2TurnItem {
  return {
    id: `item-${fileName}` as any,
    threadId: "thread-1" as any,
    runId: runId as any,
    nodeId: "node-1" as any,
    providerThreadId: "p-1" as any,
    providerTurnId: null,
    nativeItemRef: null,
    parentItemId: null,
    ordinal: 1,
    status: "completed",
    title: fileName,
    startedAt: null,
    completedAt: null,
    updatedAt: "2026-10-11T00:00:00.000Z" as any,
    type: "file_change",
    fileName,
    ...(changes ? { changes: changes as any } : {}),
  } as OrchestrationV2TurnItem;
}

describe("uiChangedPaths", () => {
  it("keeps only changed tsx, jsx, and css under web, desktop, mobile or client-runtime for the run", () => {
    const items = [
      fileChange(RUN_A, "apps/web/src/components/Button.tsx"),
      fileChange(RUN_A, "apps/desktop/src/Window.tsx"),
      fileChange(RUN_A, "apps/mobile/src/App.tsx"),
      fileChange(RUN_A, "apps/server/src/server.ts"),
      fileChange(RUN_A, "packages/contracts/src/schema.ts"),
      fileChange(RUN_B, "apps/web/src/components/Other.tsx"),
    ];
    expect(uiChangedPaths(items, RUN_A)).toEqual([
      "apps/web/src/components/Button.tsx",
      "apps/desktop/src/Window.tsx",
      "apps/mobile/src/App.tsx",
    ]);
  });
});

describe("uiVerificationPrompt", () => {
  it("names the changed files in a self-contained prompt", () => {
    const prompt = uiVerificationPrompt(["apps/mobile/src/App.tsx"]);
    expect(prompt).toContain("Changed files: apps/mobile/src/App.tsx");
    expect(prompt).toContain("Verify the UI changes from your last turn");
  });
});
