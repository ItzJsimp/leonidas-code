import { ThreadId, TurnItemId } from "@t3tools/contracts";
import { describe, expect, it } from "vite-plus/test";

import { distillRosettaHandoff, estimateTokenCount } from "./rosettaHandoffDistillation.js";

const message = (input: {
  readonly role: "user" | "assistant";
  readonly kind: string;
  readonly text: string;
  readonly id: string;
}) => ({
  role: input.role,
  kind: input.kind,
  text: input.text,
  threadId: ThreadId.make("thread:rosetta-test"),
  runId: null,
  itemId: TurnItemId.make(`turn-item:${input.id}`),
  providerThreadId: null,
  status: "completed",
});

describe("rosettaHandoffDistillation", () => {
  it("uses a provider-neutral structured brief and preserves source references", () => {
    const envelope = distillRosettaHandoff({
      coverage: "Covers runs 1-3.",
      messages: [
        message({
          role: "user",
          kind: "user_message",
          text: "Fix account handoff.",
          id: "request",
        }),
        message({
          role: "assistant",
          kind: "assistant_message",
          text: "I found the quota router.",
          id: "state",
        }),
        message({
          role: "assistant",
          kind: "file_change",
          text: "File change: apps/server/src/router.ts",
          id: "file",
        }),
        message({
          role: "assistant",
          kind: "command_execution",
          text: "pnpm test\nExit code: 1",
          id: "command",
        }),
      ],
    });

    expect(envelope.summaryText).toContain("Cross-provider context brief");
    expect(envelope.summaryText).toContain("## Original user request");
    expect(envelope.summaryText).toContain("Fix account handoff");
    expect(envelope.summaryText).toContain("## Working set");
    expect(envelope.summaryText).toContain("apps/server/src/router.ts");
    expect(envelope.summaryText).toContain("## Failures to account for");
    expect(envelope.summaryText).toContain("turn-item:command");
    expect(envelope.metrics.estimatedRawTokens).toBeGreaterThan(0);
    expect(envelope.metrics.estimatedDistilledTokens).toBeGreaterThan(0);
  });

  it("bounds large raw items while retaining the original history item IDs", () => {
    const huge = "x".repeat(80_000);
    const envelope = distillRosettaHandoff({
      coverage: "Covers runs 1-1.",
      messages: [
        message({ role: "user", kind: "user_message", text: huge, id: "large" }),
        message({
          role: "assistant",
          kind: "assistant_message",
          text: "Continue from the source item.",
          id: "latest",
        }),
      ],
    });

    expect(envelope.summaryText.length).toBeLessThan(10_000);
    expect(envelope.summaryText).toContain("turn-item:large");
    expect(envelope.summaryText).toContain("turn-item:latest");
    expect(envelope.metrics.compressionRatio).toBeGreaterThan(1);
  });

  it("makes an unanswered user request the immediate next step", () => {
    const envelope = distillRosettaHandoff({
      coverage: "Covers runs 1-2.",
      messages: [
        message({ role: "user", kind: "user_message", text: "Fix account handoff.", id: "first" }),
        message({
          role: "assistant",
          kind: "assistant_message",
          text: "Handoff is fixed.",
          id: "answer",
        }),
        message({
          role: "user",
          kind: "user_message",
          text: "Also keep the model choice.",
          id: "latest-request",
        }),
      ],
    });

    expect(envelope.summaryText).toContain(
      "- Answer the latest user request [item:turn-item:latest-request]: Also keep the model choice.",
    );
  });

  it("continues the assistant's last state when no user request is pending", () => {
    const envelope = distillRosettaHandoff({
      coverage: "Covers run 1.",
      messages: [
        message({
          role: "user",
          kind: "user_message",
          text: "Fix account handoff.",
          id: "request",
        }),
        message({
          role: "assistant",
          kind: "assistant_message",
          text: "Testing now.",
          id: "state",
        }),
      ],
    });

    expect(envelope.summaryText).toContain("## Immediate next step");
    expect(envelope.summaryText).toContain("Continue from the latest assistant state above");
  });

  it("estimates tokens from UTF-8 text bytes", () => {
    expect(estimateTokenCount("hello world")).toBe(3);
    expect(estimateTokenCount("")).toBe(0);
  });
});
