import { describe, expect, it } from "vite-plus/test";
import { Schema } from "effect";
import * as DateTime from "effect/DateTime";
import { OrchestrationV2TurnItem, ProviderTurnId } from "@t3tools/contracts";
import { providerOutputCompliance } from "./providerOutputCompliance.ts";

const turn = ProviderTurnId.make("turn:test");
const decode = Schema.decodeUnknownSync(OrchestrationV2TurnItem);
function item(
  type: "assistant_message" | "dynamic_tool",
  ordinal: number,
  extra: Record<string, unknown> = {},
) {
  return decode({
    id: `item:${ordinal}`,
    threadId: "thread:test",
    runId: "run:test",
    nodeId: null,
    providerThreadId: null,
    providerTurnId: turn,
    nativeItemRef: null,
    parentItemId: null,
    ordinal,
    status: "completed",
    title: null,
    startedAt: null,
    completedAt: DateTime.makeUnsafe("2026-10-13T00:00:00Z"),
    updatedAt: DateTime.makeUnsafe("2026-10-13T00:00:00Z"),
    type,
    ...(type === "assistant_message"
      ? { messageId: `message:${ordinal}`, text: "word ".repeat(401), streaming: false }
      : { toolName: "html_render", input: {} }),
    ...extra,
  });
}
describe("provider output measurement", () => {
  it("measures the last completed reply and excludes other provider turns", () => {
    expect(
      providerOutputCompliance(
        [
          item("assistant_message", 2),
          item("assistant_message", 1, { text: "Progress" }),
          item("assistant_message", 3, { providerTurnId: "other", text: "Done" }),
        ],
        turn,
      ),
    ).toMatchObject({ eligible: true, canvas: false, wordCount: 401 });
    expect(
      providerOutputCompliance([item("assistant_message", 1, { streaming: true })], turn),
    ).toBeUndefined();
    expect(providerOutputCompliance([], turn)).toBeUndefined();
  });
  it("counts only successful publication in this provider turn", () => {
    const output = {
      htmlRender: { attachmentId: "canvas:test", title: "Architecture", height: 400 },
    };
    expect(
      providerOutputCompliance(
        [item("assistant_message", 2), item("dynamic_tool", 1, { output })],
        turn,
      )?.canvas,
    ).toBe(true);
    for (const change of [
      { toolName: "html_preview" },
      { status: "failed" },
      { providerTurnId: "other" },
      { output: { ...output, isError: true } },
    ]) {
      expect(
        providerOutputCompliance(
          [item("assistant_message", 2), item("dynamic_tool", 1, { output, ...change })],
          turn,
        )?.canvas,
      ).toBe(false);
    }
  });
});
