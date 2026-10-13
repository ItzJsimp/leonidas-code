export const DOCK_HEADINGS = {
  "### 🎯 TL;DR": "summary",
  "### ⚡ Immediate Next Actions": "actions",
  "### 🏁 Session Complete": "complete",
  "### ❓ Input & Decisions Needed": "decisions",
} as const;

type DockKind = (typeof DOCK_HEADINGS)[keyof typeof DOCK_HEADINGS];
export type DockItem =
  | { kind: "markdown"; text: string }
  | { kind: "action"; text: string; checked: boolean }
  | { kind: "option"; text: string; reply: string }
  | { kind: "replies"; replies: string[] };
export type DockSection = { kind: DockKind; heading: string; items: DockItem[] };

/** Only terminal, ordered exact-heading Docks become controls; other text stays Markdown. */
export function parseOutputDock(text: string) {
  const lines = text.replaceAll("\r\n", "\n").split("\n");
  const headings: { index: number; kind: DockKind; heading: string }[] = [];
  let fence: { char: string; length: number } | null = null;
  let invalid = false;
  for (const [index, line] of lines.entries()) {
    const marker = /^ {0,3}(`{3,}|~{3,})/.exec(line)?.[1];
    if (marker) {
      if (!fence) fence = { char: marker[0]!, length: marker.length };
      else if (marker[0] === fence.char && marker.length >= fence.length && line.trim() === marker)
        fence = null;
      continue;
    }
    if (fence) continue;
    const heading = line.trimEnd();
    if (Object.hasOwn(DOCK_HEADINGS, heading)) {
      headings.push({ index, heading, kind: DOCK_HEADINGS[heading as keyof typeof DOCK_HEADINGS] });
    } else if (headings.length > 0 && /^#{1,6} /.test(line)) invalid = true;
  }
  if (invalid || fence || headings[0]?.kind !== "summary") return null;
  const order = { summary: 0, actions: 1, complete: 1, decisions: 2 };
  if (headings.some((h, i) => i > 0 && order[h.kind] <= order[headings[i - 1]!.kind])) return null;
  const sections: DockSection[] = [];
  for (const [i, h] of headings.entries()) {
    const content = lines
      .slice(h.index + 1, headings[i + 1]?.index)
      .join("\n")
      .trim();
    if (!content) return null;
    const items: DockItem[] = [];
    let block: string[] = [];
    const flush = () => {
      const value = block.join("\n").trim();
      if (value) items.push({ kind: "markdown", text: value });
      block = [];
    };
    let inFence = false;
    for (const line of content.split("\n")) {
      if (/^ {0,3}(?:`{3,}|~{3,})/.test(line)) {
        inFence = !inFence;
        block.push(line);
        continue;
      }
      if (inFence) {
        block.push(line);
        continue;
      }
      const action = h.kind === "actions" ? /^- \[([ xX])\] ((?:🤖|👤) .+)$/.exec(line) : null;
      const option = h.kind === "decisions" ? /^- \*\*([A-Z])\)\*\* (.+)$/.exec(line) : null;
      const quick = h.kind === "decisions" ? /^💬 Quick Replies: (.+)$/.exec(line) : null;
      if (action) {
        flush();
        items.push({ kind: "action", checked: action[1] !== " ", text: action[2]! });
      } else if (option) {
        flush();
        items.push({ kind: "option", reply: option[1]!, text: `**${option[1]})** ${option[2]}` });
      } else if (quick) {
        const replies = quick[1]!.split(/\s*\|\s*/).map((v) => /^["“](.+)["”]$/.exec(v)?.[1]);
        if (replies.every((v): v is string => v !== undefined)) {
          flush();
          items.push({ kind: "replies", replies });
        } else block.push(line);
      } else if (items.at(-1)?.kind === "option" && /^\s+\S/.test(line)) {
        const item = items.at(-1)!;
        if (item.kind === "option") item.text += `\n${line}`;
      } else block.push(line);
    }
    flush();
    sections.push({ kind: h.kind, heading: h.heading.slice(4), items });
  }
  return {
    body: lines
      .slice(0, headings[0]!.index)
      .join("\n")
      .replace(/\n---\s*$/, "")
      .trimEnd(),
    sections,
  };
}

export function workedForMs(start: string | null | undefined, end: string | null | undefined) {
  if (!start || !end) return null;
  const elapsed = Date.parse(end) - Date.parse(start);
  return Number.isFinite(elapsed) && elapsed >= 0 ? elapsed : null;
}
