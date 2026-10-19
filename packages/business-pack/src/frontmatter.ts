/** Flat `key: value` lines of a leading `---` block. No nesting; quotes are stripped. */
export function readFrontmatter(text: string): Record<string, string> {
  const match = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text.replace(/^\uFEFF/, ""));
  if (!match) return {};
  const fields: Record<string, string> = {};
  for (const line of match[1]!.split(/\r?\n/)) {
    const pair = /^([A-Za-z0-9_]+):\s*(.*)$/.exec(line);
    if (!pair) continue;
    fields[pair[1]!] = pair[2]!.trim().replace(/^(["'])(.*)\1$/, "$2");
  }
  return fields;
}
