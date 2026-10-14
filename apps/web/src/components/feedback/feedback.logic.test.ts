import { describe, expect, it } from "vitest";

import {
  buildFeedbackReport,
  guessFeedbackType,
  LAST_ERROR_MAX_AGE_MS,
  MAX_SCREENSHOT_CHARS,
  redactErrorText,
} from "./feedback.logic";
import { buildAboutPrefill } from "./feedbackContextMenu";

const base = {
  installId: "install-1",
  name: "",
  type: "bug" as const,
  text: "  it crashed  ",
  screenshot: null,
  source: "hotkey",
  appVersion: "0.21.0",
  platform: "Win32",
  route: "/",
  now: new Date("2026-10-13T10:00:00.000Z"),
};

describe("guessFeedbackType", () => {
  it("reads broken behaviour as a bug", () => {
    expect(guessFeedbackType("The sidebar is broken after update")).toBe("bug");
    expect(guessFeedbackType("it won't open my project")).toBe("bug");
  });

  it("reads wishes as ideas and anything else as a suggestion", () => {
    expect(guessFeedbackType("What if chats could be pinned")).toBe("idea");
    expect(guessFeedbackType("The spacing feels tight")).toBe("suggestion");
  });
});

describe("buildFeedbackReport", () => {
  it("keeps only the top-level screen so chat and project ids are not sent", () => {
    const report = buildFeedbackReport({
      ...base,
      route: "/2b4b41b3-ecaf-4446-a9e5-a9163943fe92/thread-9?x=1",
    });
    expect(report.context.route).toBe("/chat");
    expect(buildFeedbackReport({ ...base, route: "/usage" }).context.route).toBe("/usage");
    expect(buildFeedbackReport(base).context.route).toBe("/");
  });

  it("trims text, omits an empty name and drops oversized screenshots", () => {
    const report = buildFeedbackReport({
      ...base,
      screenshot: "x".repeat(MAX_SCREENSHOT_CHARS + 1),
    });
    expect(report.text).toBe("it crashed");
    expect(report).not.toHaveProperty("name");
    expect(report).not.toHaveProperty("screenshot");
    expect(report.context.submittedAt).toBe("2026-10-13T10:00:00.000Z");
  });
});

const BS = String.fromCharCode(92);

describe("report context", () => {
  const now = base.now.getTime();

  it("attaches provider, model and a recent error with user folders and keys scrubbed", () => {
    const report = buildFeedbackReport({
      ...base,
      provider: "codex",
      model: "gpt-5",
      lastError: {
        text: `ENOENT C:${BS}Users${BS}Jacob${BS}proj key sk-abcdefghijklmnop1234`,
        at: now - 1000,
      },
    });
    expect(report.context).toMatchObject({ provider: "codex", model: "gpt-5" });
    expect(report.context.lastError).toBe(`ENOENT ~${BS}proj key [redacted]`);
  });

  it("leaves out an error that is too old to be related", () => {
    const report = buildFeedbackReport({
      ...base,
      lastError: { text: "boom", at: now - LAST_ERROR_MAX_AGE_MS - 1 },
    });
    expect(report.context).not.toHaveProperty("lastError");
  });

  it("redacts unix home folders", () => {
    expect(redactErrorText("open /home/mob/x failed")).toBe("open ~/x failed");
  });
});

describe("buildAboutPrefill", () => {
  it("leaves the comment line first and quotes a collapsed excerpt after it", () => {
    expect(buildAboutPrefill("message", "  hello   world ")).toBe(
      ["", "", "---", "About this message:", "> hello world"].join(String.fromCharCode(10)),
    );
    expect(buildAboutPrefill("error", "   ")).toBe("");
  });
});
