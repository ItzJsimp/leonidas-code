import type { ScribeDictionary } from "@t3tools/contracts";

/** The engine refuses a vocabulary list longer than this (contract v1.2). */
export const VOCABULARY_CAP = 800;

type Replacement = ScribeDictionary["replacements"][number];

export type DictionaryEdit =
  | { readonly ok: true; readonly dictionary: ScribeDictionary }
  | { readonly ok: false; readonly message: string };

const lower = (value: string) => value.trim().toLowerCase();

/** A new word fix, or a new spelling for a rule that already has that wrong word. */
export function addReplacement(
  dictionary: ScribeDictionary,
  wrong: string,
  correct: string,
): DictionaryEdit {
  const rule: Replacement = { wrong: wrong.trim(), correct: correct.trim() };
  if (!rule.wrong || !rule.correct) {
    return {
      ok: false,
      message: "Fill in both boxes: the wrong word and the right spelling.",
    };
  }
  const exists = dictionary.replacements.some((item) => lower(item.wrong) === lower(rule.wrong));
  const replacements = exists
    ? dictionary.replacements.map((item) =>
        lower(item.wrong) === lower(rule.wrong) ? { ...item, correct: rule.correct } : item,
      )
    : [...dictionary.replacements, rule];
  return { ok: true, dictionary: { ...dictionary, replacements } };
}

export function removeReplacement(dictionary: ScribeDictionary, wrong: string): ScribeDictionary {
  return {
    ...dictionary,
    replacements: dictionary.replacements.filter((item) => item.wrong !== wrong),
  };
}

export function addVocabulary(dictionary: ScribeDictionary, word: string): DictionaryEdit {
  const term = word.trim();
  if (!term) return { ok: false, message: "Type a word first." };
  if (dictionary.vocabulary.some((item) => lower(item) === lower(term))) {
    return { ok: false, message: `“${term}” is already in your word list.` };
  }
  if (dictionary.vocabulary.length >= VOCABULARY_CAP) {
    return {
      ok: false,
      message: `Your word list is full (${VOCABULARY_CAP} words). Remove one to add another.`,
    };
  }
  return { ok: true, dictionary: { ...dictionary, vocabulary: [...dictionary.vocabulary, term] } };
}

export function removeVocabulary(dictionary: ScribeDictionary, word: string): ScribeDictionary {
  return { ...dictionary, vocabulary: dictionary.vocabulary.filter((item) => item !== word) };
}

export function filterReplacements(
  replacements: readonly Replacement[],
  query: string,
): readonly Replacement[] {
  const needle = lower(query);
  if (!needle) return replacements;
  return replacements.filter(
    (item) =>
      item.wrong.toLowerCase().includes(needle) || item.correct.toLowerCase().includes(needle),
  );
}

export function filterVocabulary(vocabulary: readonly string[], query: string): readonly string[] {
  const needle = lower(query);
  return needle ? vocabulary.filter((word) => word.toLowerCase().includes(needle)) : vocabulary;
}

/** Accepting a suggestion adds it as a word fix; the engine then stops listing it. */
export function acceptSuggestion(
  dictionary: ScribeDictionary,
  suggestion: { readonly wrong: string; readonly correct: string },
): DictionaryEdit {
  return addReplacement(dictionary, suggestion.wrong, suggestion.correct);
}

export function suggestionWhy(count: number): string {
  return `Fixed ${count} ${count === 1 ? "time" : "times"} in your dictations`;
}
