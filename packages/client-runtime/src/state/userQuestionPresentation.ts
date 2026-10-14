import type { UserInputQuestion } from "@t3tools/contracts";

const plainText = (text: string) => text.replace(/\*\*|_(?=\()|(?<=\))_/g, "").trim();

/** Repair complete grill-style option blocks for display only; provider answer values stay exact. */
export function deriveUserQuestionPresentation(
  input: Pick<UserInputQuestion, "question" | "options">,
) {
  const text = plainText(input.question);
  const blocks = [...text.matchAll(/(?:^|\s)-\s+([A-Z])\)\s+([^:\n]+):\s*/g)];
  const canExtract =
    blocks.length > 0 &&
    blocks.length === input.options.length &&
    blocks.every((block, index) => block[1] === String.fromCharCode(65 + index));
  const recommendation = canExtract ? /➡️\s*Recommended:\s*([A-Z])\s*[—–-]?\s*/.exec(text) : null;
  return {
    question: canExtract
      ? text
          .slice(0, blocks[0]!.index)
          .replace(/^❓\s*/, "")
          .trim()
      : input.question,
    options: input.options.map((option, index) => {
      const letter = String.fromCharCode(65 + index);
      const label = plainText(option.label)
        .replace(/\s*\(recommended\)\s*$/i, "")
        .replace(/^[A-Z]\s*[)—–-]\s*/, "");
      const recommended =
        (label.length > 0 && /\s*\(recommended\)\s*$/i.test(option.label)) ||
        recommendation?.[1] === letter;
      const block = canExtract ? blocks[index] : undefined;
      const extracted = block
        ? text
            .slice(
              block.index + block[0].length,
              blocks[index + 1]?.index ?? recommendation?.index ?? text.length,
            )
            .trim()
        : undefined;
      const description =
        option.description && option.description !== option.label ? option.description : extracted;
      const rationale =
        recommended && recommendation
          ? text.slice(recommendation.index + recommendation[0].length).trim()
          : undefined;
      return {
        letter,
        label: label || option.label,
        recommended,
        description: [description, rationale].filter(Boolean).join(" "),
        value: option.value ?? option.label,
      };
    }),
  };
}
