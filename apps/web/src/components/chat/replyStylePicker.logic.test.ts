import { describe, expect, it } from "vite-plus/test";
import type { ReplyStylePreset } from "@t3tools/contracts";

import {
  replyStyleBodyForRepair,
  replyStyleDraftProblem,
  replyStyleSlugFromName,
  resolveReplyStyleChip,
} from "./replyStylePicker.logic";

const LEONIDAS: ReplyStylePreset = {
  slug: "leonidas",
  name: "Leonidas",
  description: "",
  builtin: true,
};
const JAKE: ReplyStylePreset = { slug: "jake", name: "Jake", description: "", builtin: false };
const BROKEN: ReplyStylePreset = {
  slug: "broken",
  name: "broken",
  description: "",
  builtin: false,
  problem: "too-long",
};

describe("resolveReplyStyleChip", () => {
  it("uses the chat choice before the project choice", () => {
    const chip = resolveReplyStyleChip({
      presets: [LEONIDAS, JAKE],
      chatSlug: "jake",
      projectSlug: "leonidas",
    });
    expect(chip).toMatchObject({
      label: "Jake",
      source: "chat",
      activeSlug: "jake",
      problem: null,
    });
  });

  it("inherits the project choice when the chat has none", () => {
    const chip = resolveReplyStyleChip({
      presets: [LEONIDAS, JAKE],
      chatSlug: null,
      projectSlug: "jake",
    });
    expect(chip).toMatchObject({ label: "Jake", source: "project" });
  });

  it("falls back to Leonidas for a broken file", () => {
    const chip = resolveReplyStyleChip({
      presets: [LEONIDAS, BROKEN],
      chatSlug: "broken",
      projectSlug: "leonidas",
    });
    expect(chip).toMatchObject({
      label: "Leonidas",
      activeSlug: "leonidas",
      selectedSlug: "broken",
      problem: { slug: "broken", reason: "too-long" },
    });
  });

  it("falls back to Leonidas for a file that is not listed", () => {
    const chip = resolveReplyStyleChip({
      presets: [LEONIDAS],
      chatSlug: null,
      projectSlug: "gone",
    });
    expect(chip.problem).toEqual({ slug: "gone", name: "gone", reason: "missing" });
  });

  it("shows no problem while the list loads", () => {
    const chip = resolveReplyStyleChip({
      presets: null,
      chatSlug: "jake",
      projectSlug: "leonidas",
    });
    expect(chip).toMatchObject({ label: "jake", problem: null });
  });
});

describe("replyStyleSlugFromName", () => {
  it("makes a file-safe slug", () => {
    expect(replyStyleSlugFromName("  My Style! v2 ", [])).toBe("my-style-v2");
  });

  it("never reuses a taken slug or leonidas", () => {
    expect(replyStyleSlugFromName("My style", ["my-style", "my-style-2"])).toBe("my-style-3");
    expect(replyStyleSlugFromName("Leonidas", [])).toBe("leonidas-2");
  });

  it("names a style with no letters", () => {
    expect(replyStyleSlugFromName("!!!", [])).toBe("style");
  });
});

describe("replyStyleDraftProblem", () => {
  it("needs a name, a body, and a body inside the cap", () => {
    expect(replyStyleDraftProblem({ name: "", body: "x" })).toBe("Add a name.");
    expect(replyStyleDraftProblem({ name: "A", body: " " })).toBe("Add instructions.");
    expect(replyStyleDraftProblem({ name: "A", body: "x".repeat(4_001) })).toMatch(/4,000/);
    expect(replyStyleDraftProblem({ name: "A", body: "x".repeat(4_000) })).toBeNull();
  });
});

describe("replyStyleBodyForRepair", () => {
  it("drops an old frontmatter block so Save does not write it twice", () => {
    expect(replyStyleBodyForRepair("---\r\nname: \n---\r\n\nBe brief.\n")).toBe("Be brief.");
  });

  it("keeps a file with no frontmatter whole", () => {
    expect(replyStyleBodyForRepair("Be brief.\n---\nmore")).toBe("Be brief.\n---\nmore");
  });
});
