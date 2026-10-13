import type { OrchestrationV2ConversationMessage } from "@t3tools/contracts";
import { describe, expect, it } from "@effect/vitest";

import { isLoggableRequest, titleFromRequest } from "./TaskAutoLog.ts";

const message = (patch: Record<string, unknown>) =>
  ({
    role: "user",
    streaming: false,
    text: "Fix the login redirect bug",
    ...patch,
  }) as unknown as OrchestrationV2ConversationMessage;

describe("isLoggableRequest", () => {
  it("logs a typed user request", () => {
    expect(isLoggableRequest(message({}))).toBe(true);
  });

  it("skips replies, relays, schedules and still-streaming text", () => {
    expect(isLoggableRequest(message({ text: "ok thanks" }))).toBe(false);
    expect(isLoggableRequest(message({ role: "assistant" }))).toBe(false);
    expect(isLoggableRequest(message({ streaming: true }))).toBe(false);
    expect(isLoggableRequest(message({ senderThreadId: "t1" }))).toBe(false);
    expect(isLoggableRequest(message({ scheduledTaskId: "s1" }))).toBe(false);
    expect(isLoggableRequest(message({ delegatedCompletion: {} }))).toBe(false);
  });
});

describe("titleFromRequest", () => {
  it("uses the first line", () => {
    expect(titleFromRequest("Add dark mode\nand also fix the sidebar")).toBe("Add dark mode");
  });

  it("shortens a long line at a word boundary", () => {
    const title = titleFromRequest(`${"word ".repeat(40)}end`);
    expect(title.length).toBeLessThanOrEqual(80);
    expect(title.endsWith("…")).toBe(true);
  });
});
