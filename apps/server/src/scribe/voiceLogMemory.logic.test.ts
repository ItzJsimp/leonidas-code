// @effect-diagnostics globalDate:off globalDateInEffect:off -- Local calendar cutoffs and fixtures use the operating system time zone.
import { expect, it } from "vite-plus/test";
import type { ScribeHistoryItem } from "@t3tools/contracts";
import { voiceLogTexts, voiceLogWindow } from "./voiceLogMemory.logic.ts";

const take = (patch: Partial<ScribeHistoryItem> = {}) =>
  ({
    at: "2026-10-19T12:00:00Z",
    app: "Code.exe",
    private: false,
    cleanedText: "I prefer short replies.",
    ...patch,
  }) as ScribeHistoryItem;
const start = Date.parse("2026-10-19T00:00:00Z");
const end = start + 86_400_000;
it("never reads text from private, unflagged, blocked or unknown apps", () => {
  const unreadable = {
    get cleanedText(): string {
      throw new Error("private text was read");
    },
  };
  const privateTake = take({ private: true });
  Object.defineProperty(
    privateTake,
    "cleanedText",
    Object.getOwnPropertyDescriptor(unreadable, "cleanedText")!,
  );
  const unknownTake = take({ private: undefined });
  Object.defineProperty(
    unknownTake,
    "cleanedText",
    Object.getOwnPropertyDescriptor(unreadable, "cleanedText")!,
  );
  expect(
    voiceLogTexts(
      [privateTake, unknownTake, take({ app: "Bitwarden.exe" }), take({ app: "" }), take()],
      ["bitwarden"],
      start,
      end,
    ),
  ).toEqual(["I prefer short replies."]);
});
it("uses only the selected night and bounds model input", () => {
  expect(
    voiceLogTexts([take({ at: "invalid" }), take({ at: "2026-10-18T12:00:00Z" })], [], start, end),
  ).toEqual([]);
  expect(
    voiceLogTexts(
      Array.from({ length: 300 }, () => take({ cleanedText: "a".repeat(5000) })),
      [],
      start,
      end,
    ).join(""),
  ).toHaveLength(40_000);
});
it("uses the latest 3 AM local cutoff, including startup before 3 AM", () => {
  const now = new Date(2026, 9, 19, 2, 0);
  const night = voiceLogWindow(now.getTime());
  expect(night.day).toBe("2026-10-18");
  expect(new Date(night.until).getHours()).toBe(3);
  expect(voiceLogWindow(new Date(2026, 9, 19, 3, 0).getTime()).day).toBe("2026-10-19");
});
