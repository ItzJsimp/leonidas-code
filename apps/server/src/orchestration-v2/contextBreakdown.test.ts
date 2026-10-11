import { describe, expect, it } from "vite-plus/test";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import { ThreadId, type OrchestrationV2TurnItem } from "@t3tools/contracts";
import type { ProviderAdapterV2ContextReport } from "@t3tools/provider-core/server/ProviderAdapter";

import {
  buildContextBreakdown,
  estimateTokens,
  estimateTranscript,
  queryThreadContextBreakdown,
  readContextMeter,
} from "./contextBreakdown.ts";

describe("contextBreakdown", () => {
  describe("estimateTokens", () => {
    it("returns 0 for empty string", () => {
      expect(estimateTokens("")).toBe(0);
    });

    it("estimates tokens based on UTF-8 bytes / 4", () => {
      expect(estimateTokens("abcd")).toBe(1);
      expect(estimateTokens("12345678")).toBe(2);
    });
  });

  describe("estimateTranscript", () => {
    it("aggregates file reads, edits, and tool calls", () => {
      const items: OrchestrationV2TurnItem[] = [
        {
          id: "item-1",
          ordinal: 1,
          type: "dynamic_tool",
          status: "completed",
          toolName: "read_file",
          input: { filePath: "src/main.ts" },
          output: "const x = 1;\nconsole.log(x);",
          runId: "run-1",
        } as any,
        {
          id: "item-2",
          ordinal: 2,
          type: "file_change",
          status: "completed",
          fileName: "src/main.ts",
          diffStr: "+++ b/src/main.ts\n@@ -1 +1,2 @@\n+const y = 2;",
          runId: "run-1",
        } as any,
        {
          id: "item-3",
          ordinal: 3,
          type: "reasoning",
          status: "completed",
          text: "Let me think about this for a long time...",
          runId: "run-1",
        } as any,
        {
          id: "item-4",
          ordinal: 4,
          type: "assistant_message",
          status: "completed",
          text: "I finished updating the file.",
          runId: "run-1",
        } as any,
      ];

      const runTurnIndex = new Map([["run-1", 1]]);
      const estimate = estimateTranscript({ items, runTurnIndex });

      expect(estimate.hasReasoning).toBe(true);
      expect(estimate.compacted).toBe(false);
      expect(estimate.toolCalls.length).toBe(2);
      expect(estimate.files.length).toBe(1);
      expect(estimate.files[0]?.path).toBe("src/main.ts");
      expect(estimate.files[0]?.origin).toBe("edit");
      expect(estimate.files[0]?.readCount).toBe(1);
      expect(estimate.files[0]?.lastTurnIndex).toBe(1);
    });

    it("discards items prior to latest completed compaction", () => {
      const items: OrchestrationV2TurnItem[] = [
        {
          id: "item-old",
          ordinal: 1,
          type: "dynamic_tool",
          status: "completed",
          toolName: "read_file",
          input: { filePath: "old.ts" },
          output: "old content",
          runId: "run-1",
        } as any,
        {
          id: "item-compaction",
          ordinal: 2,
          type: "compaction",
          status: "completed",
          afterTokenCount: 500,
          summary: "Summary of earlier conversation",
          runId: "run-1",
        } as any,
        {
          id: "item-new",
          ordinal: 3,
          type: "dynamic_tool",
          status: "completed",
          toolName: "read_file",
          input: { filePath: "new.ts" },
          output: "new content",
          runId: "run-2",
        } as any,
      ];

      const runTurnIndex = new Map([
        ["run-1", 1],
        ["run-2", 2],
      ]);
      const estimate = estimateTranscript({ items, runTurnIndex });

      expect(estimate.compacted).toBe(true);
      expect(estimate.summaryTokens).toBe(500);
      expect(estimate.files.length).toBe(1);
      expect(estimate.files[0]?.path).toBe("new.ts");
    });
  });

  describe("readContextMeter", () => {
    it("prefers newest providerTurn with tokenUsage", () => {
      const reading = readContextMeter({
        providerTurns: [
          { tokenUsage: { usedTokens: 100, maxTokens: 1000 } as any },
          { tokenUsage: { usedTokens: 250, maxTokens: 2000 } as any },
        ],
        activeProviderThread: { contextUsage: { usedTokens: 50, maxTokens: 500 } as any },
        items: [],
      });

      expect(reading).toEqual({ usedTokens: 250, maxTokens: 2000 });
    });

    it("falls back to activeProviderThread snapshot if turns have no usage", () => {
      const reading = readContextMeter({
        providerTurns: [],
        activeProviderThread: { contextUsage: { usedTokens: 75, maxTokens: 1000 } as any },
        items: [],
      });

      expect(reading).toEqual({ usedTokens: 75, maxTokens: 1000 });
    });

    it("falls back to latest compaction afterTokenCount", () => {
      const reading = readContextMeter({
        providerTurns: [],
        activeProviderThread: null,
        items: [
          {
            id: "compaction-1",
            ordinal: 1,
            type: "compaction",
            afterTokenCount: 1200,
          } as any,
        ],
      });

      expect(reading).toEqual({ usedTokens: 1200, maxTokens: null });
    });
  });

  describe("buildContextBreakdown", () => {
    it("combines provider report with estimated files and tool calls", () => {
      const report: ProviderAdapterV2ContextReport = {
        model: "claude-sonnet-5-5",
        totalTokens: 1000,
        maxTokens: 200_000,
        categories: [
          { name: "Messages", kind: "used", tokens: 800 },
          { name: "System", kind: "used", tokens: 200 },
        ],
        memoryFiles: [{ path: "AGENTS.md", type: "memory", tokens: 150 }],
        mcpTools: [{ name: "search", server: "fs", tokens: 50 }],
        skills: [{ name: "tdd", source: "local", tokens: 25 }],
        agents: [],
      };

      const estimate = {
        toolCalls: [
          {
            id: "call-1",
            name: "read_file",
            target: "src/app.ts",
            tokens: 100,
            estimated: true,
            turnIndex: 1,
            status: "ok" as const,
          },
        ],
        files: [
          {
            path: "src/app.ts",
            tokens: 100,
            estimated: true,
            readCount: 1,
            lastTurnIndex: 1,
            origin: "read" as const,
          },
        ],
        messageTokens: 200,
        summaryTokens: null,
        hasReasoning: false,
        compacted: false,
      };

      const breakdown = buildContextBreakdown({
        estimate,
        meter: { usedTokens: 1000, maxTokens: 200_000 },
        report,
      });

      expect(breakdown.source).toBe("mixed");
      expect(breakdown.totalTokens).toBe(1000);
      expect(breakdown.maxTokens).toBe(200_000);
      expect(breakdown.categories.length).toBe(2);
      expect(breakdown.files.length).toBe(2); // 1 memory file + 1 estimated file
      expect(breakdown.files[0]?.path).toBe("AGENTS.md");
      expect(breakdown.files[0]?.origin).toBe("memory");
      expect(breakdown.files[1]?.path).toBe("src/app.ts");
      expect(breakdown.mcpTools.length).toBe(1);
    });

    it("falls back to transcript estimation when report is null", () => {
      const estimate = {
        toolCalls: [
          {
            id: "call-1",
            name: "read_file",
            target: "src/app.ts",
            tokens: 100,
            estimated: true,
            turnIndex: 1,
            status: "ok" as const,
          },
        ],
        files: [
          {
            path: "src/app.ts",
            tokens: 100,
            estimated: true,
            readCount: 1,
            lastTurnIndex: 1,
            origin: "read" as const,
          },
        ],
        messageTokens: 300,
        summaryTokens: null,
        hasReasoning: false,
        compacted: false,
      };

      const breakdown = buildContextBreakdown({
        estimate,
        meter: { usedTokens: 600, maxTokens: 100_000 },
        report: null,
      });

      expect(breakdown.source).toBe("estimated");
      expect(breakdown.totalTokens).toBe(600);
      expect(breakdown.maxTokens).toBe(100_000);
      expect(breakdown.categories.some((c) => c.name === "Messages")).toBe(true);
      expect(breakdown.categories.some((c) => c.name === "Tool calls")).toBe(true);
      expect(breakdown.categories.some((c) => c.name === "Other / unattributed")).toBe(true);
      expect(breakdown.categories.some((c) => c.name === "Free space")).toBe(true);
    });
  });

  describe("queryThreadContextBreakdown", () => {
    it("returns estimated breakdown when no live report is available", async () => {
      const threadId = ThreadId.make("thread-test-1");
      const fakeThread = {
        id: threadId,
        activeProviderThreadId: null,
        deletedAt: null,
        providerInstanceId: "claude-default",
        modelSelection: { instanceId: "claude-default", model: "claude-sonnet-5-5" },
      };

      const result = await Effect.runPromise(
        queryThreadContextBreakdown({
          threadId,
          threadManagement: {
            getThreadRecords: () =>
              Effect.succeed({
                thread: fakeThread as any,
                runs: [],
                turnItems: [
                  {
                    id: "item-1",
                    ordinal: 1,
                    type: "assistant_message",
                    text: "Hello world!",
                  } as any,
                ],
                providerTurns: [],
                providerThreads: [],
                providerSessions: [],
              }),
          },
          providerSessions: {
            get: () => Effect.succeed(Option.none()),
          },
        }),
      );

      expect(result.threadId).toBe(threadId);
      expect(result.source).toBe("estimated");
      expect(result.model).toBe("claude-sonnet-5-5");
      expect(result.totalTokens).toBeGreaterThan(0);
      expect(result.categories.some((c) => c.name === "Messages")).toBe(true);
    });

    it("fails with thread-not-found when thread is deleted or missing", async () => {
      const threadId = ThreadId.make("thread-deleted");
      const exit = await Effect.runPromiseExit(
        queryThreadContextBreakdown({
          threadId,
          threadManagement: {
            getThreadRecords: () =>
              Effect.succeed({
                thread: { id: threadId, deletedAt: new Date() } as any,
                runs: [],
                turnItems: [],
                providerTurns: [],
                providerThreads: [],
                providerSessions: [],
              }),
          },
          providerSessions: {
            get: () => Effect.succeed(Option.none()),
          },
        }),
      );

      expect(exit._tag).toBe("Failure");
    });
  });
});
