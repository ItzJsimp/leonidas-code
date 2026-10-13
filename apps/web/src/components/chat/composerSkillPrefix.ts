/**
 * Puts `$name ` at the very start of the prompt, the way a typed skill command leads it.
 * Returns the prompt unchanged when it already starts with that skill.
 */
export function prefixPromptWithSkill(prompt: string, skillName: string): string {
  const marker = `$${skillName}`;
  const leading = prompt.trimStart();
  if (leading === marker || leading.startsWith(`${marker} `) || leading.startsWith(`${marker}\n`)) {
    return prompt;
  }
  return `${marker} ${prompt}`;
}
