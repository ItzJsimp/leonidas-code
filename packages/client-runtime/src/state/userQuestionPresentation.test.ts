import { describe, expect, it } from "vite-plus/test";
import { deriveUserQuestionPresentation } from "./userQuestionPresentation.ts";

describe("question card presentation", () => {
  it("moves a Markdown interview into its choices without changing answer values", () => {
    const result = deriveUserQuestionPresentation({
      question:
        "❓ **Q6 — Prerequisites:** Which starting condition? - **A) Existing account:** Recruit existing subscribers. _(Wins when: fastest setup.)_ - **B) Guided signup:** Guide account creation. _(Wins when: beginners.)_ ➡️ **Recommended: A** — Lower setup burden. **What flips it:** Most users need accounts.",
      options: [
        {
          label: "A — Existing account (Recommended)",
          description: "A — Existing account (Recommended)",
          value: "exact-a",
        },
        { label: "B — Guided signup", description: "B — Guided signup" },
      ],
    });
    expect(result.question).toBe("Q6 — Prerequisites: Which starting condition?");
    expect(result.options[0]).toMatchObject({
      label: "Existing account",
      letter: "A",
      recommended: true,
      value: "exact-a",
    });
    expect(result.options[0]?.description).toContain(
      "Recruit existing subscribers. (Wins when: fastest setup.)",
    );
    expect(result.options[0]?.description).toContain("Lower setup burden.");
    expect(result.options[1]).toMatchObject({
      label: "Guided signup",
      letter: "B",
      recommended: false,
      value: "B — Guided signup",
      description: "Guide account creation. (Wins when: beginners.)",
    });
  });

  it("preserves structured descriptions and exact provider labels as answer values", () => {
    const result = deriveUserQuestionPresentation({
      question: "Choose a path",
      options: [
        {
          label: "Native (Recommended)",
          description: "Why: smaller. Flips if: custom requirements.",
        },
        { label: "Custom", description: "Custom", value: "  id  " },
      ],
    });
    expect(result.question).toBe("Choose a path");
    expect(result.options[0]).toMatchObject({
      label: "Native",
      value: "Native (Recommended)",
      recommended: true,
      description: "Why: smaller. Flips if: custom requirements.",
    });
    expect(result.options[1]?.value).toBe("  id  ");
  });

  it.each([
    "Mention A) first: then B) next: in prose",
    "Question - **A) One:** explanation - **C) Three:** explanation",
    "Question - **A) One:** explanation",
  ])("leaves ambiguous or incomplete option blocks intact: %s", (question) => {
    expect(
      deriveUserQuestionPresentation({
        question,
        options: [
          { label: "One", description: "One" },
          { label: "Two", description: "Two" },
        ],
      }).question,
    ).toBe(question);
  });

  it("handles empty options and CRLF interview blocks", () => {
    expect(deriveUserQuestionPresentation({ question: "Free text", options: [] }).options).toEqual(
      [],
    );
    const result = deriveUserQuestionPresentation({
      question: "Choose\r\n- **A)** **One**: First\r\n- **B)** **Two**: Second",
      options: [
        { label: "One", description: "One" },
        { label: "Two", description: "Two" },
      ],
    });
    expect(result.question).toBe("Choose");
    expect(result.options.map((option) => option.description)).toEqual(["First", "Second"]);
  });

  it("keeps labels readable when a recommendation marker is the entire answer", () => {
    const result = deriveUserQuestionPresentation({
      question: "Choose",
      options: [
        { label: "(Recommended)", description: "(Recommended)" },
        { label: "Recommended reading", description: "Recommended reading" },
        { label: "Ship (recommended) ", description: "Ship (recommended) " },
      ],
    });
    expect(result.options.map(({ label, recommended }) => ({ label, recommended }))).toEqual([
      { label: "(Recommended)", recommended: false },
      { label: "Recommended reading", recommended: false },
      { label: "Ship", recommended: true },
    ]);
  });
});
