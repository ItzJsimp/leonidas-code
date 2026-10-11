import { describe, expect, it } from "vite-plus/test";
import * as Exit from "effect/Exit";
import * as Schema from "effect/Schema";

import { ThreadContextBreakdown, ThreadContextBreakdownError } from "./contextBreakdown.ts";
import { ORCHESTRATION_V2_WS_METHODS, OrchestrationV2RpcSchemas } from "./orchestrationV2.ts";
import { WsRpcGroup } from "./rpc.ts";

const breakdown = {
  threadId: "thread-1",
  driver: "claudeAgent",
  model: "claude-opus-5",
  source: "mixed",
  capturedAt: "2026-10-10T12:00:00.000Z",
  totalTokens: 1200,
  maxTokens: 1_000_000,
  categories: [
    { name: "System prompt", kind: "used", tokens: 700, estimated: false },
    { name: "Free space", kind: "free", tokens: 998_800, estimated: false },
  ],
  files: [
    {
      path: "apps/web/src/a.ts",
      tokens: 40,
      estimated: true,
      readCount: 2,
      lastTurnIndex: 3,
      origin: "read",
    },
  ],
  toolCalls: [
    {
      id: "item-1",
      name: "Read",
      target: "apps/web/src/a.ts",
      tokens: 40,
      estimated: true,
      turnIndex: 3,
      status: "ok",
    },
  ],
  mcpTools: [{ name: "mcp__t3__list", server: "t3", tokens: 90 }],
  skills: [{ name: "tdd", source: "project", tokens: 30 }],
  agents: [{ name: "executor", source: "project", tokens: 20 }],
  notes: ["Per-file sizes are estimated from tool output"],
} as const;

describe("ThreadContextBreakdown contract", () => {
  it("round-trips a mixed breakdown", () => {
    const decoded = Schema.decodeUnknownSync(ThreadContextBreakdown)(breakdown);
    expect(Schema.encodeSync(ThreadContextBreakdown)(decoded)).toEqual(breakdown);
  });

  it("accepts a null window and null turn indices", () => {
    const decoded = Schema.decodeUnknownExit(ThreadContextBreakdown)({
      ...breakdown,
      maxTokens: null,
      model: null,
      files: [{ ...breakdown.files[0], lastTurnIndex: null }],
      toolCalls: [{ ...breakdown.toolCalls[0], turnIndex: null, target: null }],
    });
    expect(Exit.isSuccess(decoded)).toBe(true);
  });

  it("rejects unknown kinds, origins, sources and negative tokens", () => {
    const decode = Schema.decodeUnknownExit(ThreadContextBreakdown);
    expect(Exit.isFailure(decode({ ...breakdown, source: "guess" }))).toBe(true);
    expect(
      Exit.isFailure(
        decode({
          ...breakdown,
          categories: [{ name: "x", kind: "other", tokens: 1, estimated: false }],
        }),
      ),
    ).toBe(true);
    expect(
      Exit.isFailure(
        decode({ ...breakdown, files: [{ ...breakdown.files[0], origin: "unknown" }] }),
      ),
    ).toBe(true);
    expect(Exit.isFailure(decode({ ...breakdown, totalTokens: -1 }))).toBe(true);
  });

  it("carries a typed retryable error", () => {
    const error = new ThreadContextBreakdownError({
      threadId: Schema.decodeUnknownSync(ThreadContextBreakdown.fields.threadId)("thread-1"),
      reason: "provider-failed",
      retryable: true,
      message: "Claude could not report context usage",
    });
    expect(error.retryable).toBe(true);
    expect(error._tag).toBe("ThreadContextBreakdownError");
  });
});

describe("getThreadContextBreakdown RPC", () => {
  it("is registered on the websocket group with the shared input and output", () => {
    expect(ORCHESTRATION_V2_WS_METHODS.getThreadContextBreakdown).toBe(
      "orchestration.getThreadContextBreakdown",
    );
    expect(WsRpcGroup.requests.has(ORCHESTRATION_V2_WS_METHODS.getThreadContextBreakdown)).toBe(
      true,
    );
    const input = Schema.decodeUnknownSync(
      OrchestrationV2RpcSchemas.getThreadContextBreakdown.input,
    )({ threadId: "thread-1" });
    expect(input.threadId).toBe("thread-1");
  });
});
