import type { ScribeDictionary } from "@t3tools/contracts";
import { describe, expect, it } from "vite-plus/test";

import {
  VOCABULARY_CAP,
  acceptSuggestion,
  dictionaryErrorMessage,
  addReplacement,
  addVocabulary,
  filterReplacements,
  filterVocabulary,
  removeReplacement,
  removeVocabulary,
  suggestionWhy,
} from "./dictionary.logic";

const dict: ScribeDictionary = {
  replacements: [{ wrong: "btw", correct: "by the way" }],
  vocabulary: ["Gersi"],
};

describe("addReplacement", () => {
  it("adds a trimmed rule at the end", () => {
    const result = addReplacement(dict, "  cooper netties ", " Kubernetes ");
    expect(result).toEqual({
      ok: true,
      dictionary: {
        replacements: [
          { wrong: "btw", correct: "by the way" },
          { wrong: "cooper netties", correct: "Kubernetes" },
        ],
        vocabulary: ["Gersi"],
      },
    });
  });

  it("asks for both boxes", () => {
    expect(addReplacement(dict, "x", "  ")).toEqual({
      ok: false,
      message: "Fill in both boxes: the wrong word and the right spelling.",
    });
    expect(addReplacement(dict, "", "y").ok).toBe(false);
  });

  it("replaces the spelling of a rule that already has that wrong word, ignoring case", () => {
    const result = addReplacement(dict, "BTW", "by the way,");
    expect(result.ok && result.dictionary.replacements).toEqual([
      { wrong: "btw", correct: "by the way," },
    ]);
  });
});

describe("removeReplacement", () => {
  it("removes by wrong word and leaves the rest", () => {
    expect(removeReplacement(dict, "btw").replacements).toEqual([]);
    expect(removeReplacement(dict, "nope")).toEqual(dict);
  });
});

describe("vocabulary", () => {
  it("adds a trimmed word and refuses a duplicate in any case", () => {
    const added = addVocabulary(dict, "  Leonidas ");
    expect(added.ok && added.dictionary.vocabulary).toEqual(["Gersi", "Leonidas"]);
    expect(addVocabulary(dict, "gersi")).toEqual({
      ok: false,
      message: "“gersi” is already in your word list.",
    });
    expect(addVocabulary(dict, "   ")).toEqual({ ok: false, message: "Type a word first." });
  });

  it("stops at the engine cap of 800 words", () => {
    const full = { ...dict, vocabulary: Array.from({ length: VOCABULARY_CAP }, (_, i) => `w${i}`) };
    expect(addVocabulary(full, "one more")).toEqual({
      ok: false,
      message: "Your word list is full (800 words). Remove one to add another.",
    });
  });

  it("removes one word", () => {
    expect(removeVocabulary(dict, "Gersi").vocabulary).toEqual([]);
  });
});

describe("filters and suggestions", () => {
  it("filters rules on either side and words on the word, ignoring case", () => {
    expect(filterReplacements(dict.replacements, "WAY")).toHaveLength(1);
    expect(filterReplacements(dict.replacements, "zzz")).toHaveLength(0);
    expect(filterReplacements(dict.replacements, "  ")).toHaveLength(1);
    expect(filterVocabulary(dict.vocabulary, "ger")).toEqual(["Gersi"]);
  });

  it("accepts a suggestion as a word fix", () => {
    const result = acceptSuggestion(dict, { wrong: "jersey", correct: "Gersi", count: 3 });
    expect(result.ok && result.dictionary.replacements.at(-1)).toEqual({
      wrong: "jersey",
      correct: "Gersi",
    });
  });

  it("says why a suggestion appeared", () => {
    expect(suggestionWhy(3)).toBe("Fixed 3 times in your dictations");
  });
});

describe("dictionaryErrorMessage", () => {
  it("names a rejected list, a failed save and an offline engine", () => {
    expect(dictionaryErrorMessage("bad_request")).toContain("did not accept");
    expect(dictionaryErrorMessage("store_error")).toContain("could not save");
    expect(dictionaryErrorMessage("offline")).toBe(
      "Scribe engine is not running. Start it from the tray, or install it.",
    );
    expect(dictionaryErrorMessage(null)).toBe("Scribe could not do that. Try again.");
  });
});
