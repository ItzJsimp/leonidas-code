/** The absolute path of an AIOS-relative file, with forward slashes after the root. */
export function aiosFilePath(root: string, relativePath: string): string {
  return `${root.replace(/[\\/]+$/, "")}/${relativePath.replace(/^[\\/]+/, "")}`;
}

/** The note body without its YAML frontmatter, so the reader sees the text, not the fields. */
export function withoutFrontmatter(text: string): string {
  const body = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  return body.replace(/^---\r?\n[\s\S]*?\r?\n---[ \t]*(?:\r?\n|$)/, "");
}
