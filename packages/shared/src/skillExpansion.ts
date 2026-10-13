import { SKILL_MENTION_PATTERN } from "./composerInlineTokens.ts";

/**
 * Same boundary rules as a `$skill` chip, with `/` as the sigil. Only a whole
 * whitespace-delimited token counts, so `/src/index.ts` is never a skill.
 */
const SLASH_SKILL_PATTERN = /(^|\s)\/([a-zA-Z0-9][a-zA-Z0-9:_-]*)(?=\s|$)/g;

const FRONTMATTER_PATTERN = /^---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/;

/**
 * Cheap pre-check so adapters skip skill discovery on the many turns that
 * cannot name a skill. Prose like `/src` passes it; `expandSkills` decides.
 */
export function mayMentionSkill(prompt: string): boolean {
  return /(^|\s)[\p{Sc}/][a-zA-Z0-9]/u.test(prompt);
}

interface SkillMention {
  readonly name: string;
  readonly start: number;
  readonly end: number;
}

function findSkillMentions(
  prompt: string,
  skills: ReadonlyMap<string, string>,
): ReadonlyArray<SkillMention> {
  const mentions: Array<SkillMention> = [];
  for (const pattern of [SKILL_MENTION_PATTERN, SLASH_SKILL_PATTERN]) {
    for (const match of prompt.matchAll(pattern)) {
      const name = match[2] ?? "";
      if (!skills.has(name)) continue;
      const start = (match.index ?? 0) + (match[1]?.length ?? 0);
      mentions.push({ name, start, end: (match.index ?? 0) + match[0].length });
    }
  }
  return mentions.sort((left, right) => left.start - right.start);
}

/**
 * Turn skill mentions anywhere in `prompt` into one provider-neutral message.
 *
 * Every provider gets the same shape, so a skill works the same wherever it
 * sits in the prompt and whichever runtime reads it: the user's text keeps its
 * order with a `<skill name="x"/>` marker at each original spot, and each
 * skill's instructions follow once, however often it was mentioned. The text
 * after a marker up to the next marker is that skill's `$ARGUMENTS`.
 *
 * `skills` maps a known, invocable skill name to its SKILL.md contents.
 * Returns `undefined` when the prompt mentions none, so it goes out unchanged
 * (a `$HOME` or `/src` in prose never becomes a command).
 */
export function expandSkills(
  prompt: string,
  skills: ReadonlyMap<string, string>,
): string | undefined {
  const mentions = findSkillMentions(prompt, skills);
  if (mentions.length === 0) return undefined;

  const argumentsByName = new Map<string, Array<string>>();
  let request = "";
  let cursor = 0;
  mentions.forEach((mention, index) => {
    request += prompt.slice(cursor, mention.start);
    request += `<skill name="${mention.name}"/>`;
    cursor = mention.end;
    const span = prompt.slice(mention.end, mentions[index + 1]?.start ?? prompt.length).trim();
    const spans = argumentsByName.get(mention.name) ?? [];
    if (span.length > 0) spans.push(span);
    argumentsByName.set(mention.name, spans);
  });
  request += prompt.slice(cursor);

  const instructions = [...argumentsByName].map(([name, spans]) => {
    const body = (skills.get(name) ?? "").replace(FRONTMATTER_PATTERN, "").trim();
    const args = spans.join("\n");
    const filled = body.includes("$ARGUMENTS")
      ? body.replaceAll("$ARGUMENTS", args)
      : args.length > 0
        ? `${body}\n\nARGUMENTS: ${args}`
        : body;
    return `<skill_instructions name="${name}">\n${filled}\n</skill_instructions>`;
  });

  return [
    "The request mentions skills. A <skill name=\"x\"/> marker sits exactly where the user named that skill; the text after a marker up to the next marker is that skill's arguments. Follow every skill's instructions below.",
    `<request>\n${request.trim()}\n</request>`,
    ...instructions,
  ].join("\n\n");
}
