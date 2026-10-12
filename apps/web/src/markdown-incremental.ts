import type { Root, RootContent } from "mdast";
import type { Parser as UnifiedParser, Plugin } from "unified";

type Parser = UnifiedParser<Root>;

interface ParsedPrefix {
  source: string;
  offset: number;
  line: number;
  children: RootContent[];
}

function hasDefinitions(node: Root | RootContent): boolean {
  return (
    node.type === "definition" ||
    node.type === "footnoteDefinition" ||
    ("children" in node && node.children.some((child) => hasDefinitions(child)))
  );
}

function shiftPositions(node: Root | RootContent, offset: number, lines: number): void {
  if (node.position) {
    for (const point of [node.position.start, node.position.end]) {
      if (point.offset !== undefined) point.offset += offset;
      point.line += lines;
    }
  }
  if ("children" in node) {
    for (const child of node.children) shiftPositions(child, offset, lines);
  }
}

const FENCE_OPENING = /^ {0,3}(?:`{3,}|~{3,})/;
// After a blank line, these starts cannot continue a list: a marker would extend
// it, digits could become a marker, and indentation would extend an item.
const LIST_ENDING_START = /^[A-Za-z#`~<>|]$/;
const NON_SPACE = /^\S$/;

/** Whether the block before a blank-line gap is final once text at `offset` is
 * known. Indented code, HTML, and definitions can absorb or re-read later lines,
 * so they never end a cached prefix.
 */
function isSafeCut(previous: RootContent, source: string, offset: number): boolean {
  const next = source.charAt(offset);
  switch (previous.type) {
    case "paragraph":
    case "heading":
    case "thematicBreak":
    case "table":
    case "blockquote":
      return NON_SPACE.test(next);
    case "list":
      return LIST_ENDING_START.test(next);
    case "code": {
      const start = previous.position?.start.offset;
      return (
        start !== undefined &&
        FENCE_OPENING.test(source.slice(start, start + 8)) &&
        NON_SPACE.test(next)
      );
    }
    default:
      return false;
  }
}

function canResume(prefix: ParsedPrefix, source: string): boolean {
  if (source.length === prefix.offset) return true;
  const last = prefix.children.at(-1);
  return last !== undefined && isSafeCut(last, source, prefix.offset);
}

/** Keep the full document pipeline while avoiding re-parsing completed top-level
 * blocks on every token. A cut is a blank-line gap before a block that starts at
 * column one, following a block that text after the gap cannot reopen. Definitions
 * and footnotes are document-wide, so they require a full parse.
 */
function createIncrementalMarkdownParser(parse: Parser): Parser {
  let cached: ParsedPrefix | undefined;

  return (source, file) => {
    // A streaming CR can become half of a CRLF. A BOM at the suffix boundary
    // would be stripped by a new parser although it is inside the full document.
    if (source.includes("\r") || source.includes("\uFEFF")) return parse(source, file);

    const prefix =
      cached && source.startsWith(cached.source) && canResume(cached, source) ? cached : undefined;
    let root: Root;
    if (prefix) {
      root = parse(source.slice(prefix.offset), file);
      if (hasDefinitions(root)) return parse(source, file);
      shiftPositions(root, prefix.offset, prefix.line - 1);
      if (root.position) root.position.start = { line: 1, column: 1, offset: 0 };
      // Remark transforms mutate their input. The cache owns pristine nodes and
      // each render receives its own copy, including source positions.
      root.children.unshift(...structuredClone(prefix.children));
    } else {
      root = parse(source, file);
      if (hasDefinitions(root)) return root;
    }

    const cachedCount = prefix?.children.length ?? 0;
    for (let index = root.children.length - 2; index >= cachedCount; index--) {
      const previous = root.children[index]!;
      const next = root.children[index + 1]!;
      const end = previous.position?.end.offset;
      const offset = next.position?.start.offset;
      if (end === undefined || offset === undefined || next.position?.start.column !== 1) continue;
      if (!/^\n\n+$/.test(source.slice(end, offset))) continue;
      if (!isSafeCut(previous, source, offset)) continue;
      cached = {
        source: source.slice(0, offset),
        offset,
        line: next.position!.start.line,
        // Cached nodes stay pristine: only the newly parsed blocks are copied here.
        children: [
          ...(prefix?.children ?? []),
          ...structuredClone(root.children.slice(cachedCount, index + 1)),
        ],
      };
      break;
    }
    return root;
  };
}

/** One cache per streaming renderer. Extra syntax plugins must use the normal
 * parser because their document-wide dependencies are not known here.
 */
export function createIncrementalMarkdownPlugin(): Plugin<[], Root> {
  let parser: Parser | undefined;
  return function () {
    const original = this.parser;
    if (!original) return;
    parser ??= createIncrementalMarkdownParser((source, file) => original(source, file) as Root);
    const parseDocument = parser;
    // ReactMarkdown creates a processor per render. Its first parse is the
    // document; transforms can then parse synthetic recovery text on that same
    // processor. Those parses must not read or replace the document's cache.
    let documentParsed = false;
    this.parser = (source, file) => {
      if (documentParsed) return original(source, file);
      documentParsed = true;
      return parseDocument(source, file);
    };
  };
}
