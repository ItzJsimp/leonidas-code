import { ThreadId } from "@t3tools/contracts";
import { describe, expect, it } from "vite-plus/test";

import { claudeTurnEnvironment } from "./claudeFreeModelRetries.ts";

const child = {
  lineage: {
    parentThreadId: ThreadId.make("thread:parent"),
    relationshipToParent: "subagent" as const,
    rootThreadId: ThreadId.make("thread:parent"),
  },
};
const topLevel = {
  lineage: {
    parentThreadId: null,
    relationshipToParent: null,
    rootThreadId: ThreadId.make("thread:top"),
  },
};

describe("claudeTurnEnvironment", () => {
  it("caps retries for a delegated child on a free model", () => {
    const env = claudeTurnEnvironment(
      { PATH: "x" },
      { model: "cohere/north-mini-code:free", appThread: child },
    );
    expect(env.CLAUDE_CODE_MAX_RETRIES).toBe("2");
    expect(env.PATH).toBe("x");
  });

  it("keeps default retries for the user's own chats and paid models", () => {
    expect(
      claudeTurnEnvironment({}, { model: "cohere/north-mini-code:free", appThread: topLevel })
        .CLAUDE_CODE_MAX_RETRIES,
    ).toBeUndefined();
    expect(
      claudeTurnEnvironment({}, { model: "claude-haiku-5-5", appThread: child })
        .CLAUDE_CODE_MAX_RETRIES,
    ).toBeUndefined();
  });

  it("respects a retry count the instance already sets", () => {
    expect(
      claudeTurnEnvironment(
        { CLAUDE_CODE_MAX_RETRIES: "6" },
        { model: "openrouter/free", appThread: child },
      ).CLAUDE_CODE_MAX_RETRIES,
    ).toBe("6");
  });
});
