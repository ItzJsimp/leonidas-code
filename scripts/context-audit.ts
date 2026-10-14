// Reports what an agent session loads before the first message: the CLAUDE.md
// @import chain, duplicated paragraphs across it, and skill descriptions.
// Usage: node scripts/context-audit.ts [CLAUDE.md] [--skills <dir>] [--budget <tokens>]
import * as NodeFS from "node:fs";
import * as NodePath from "node:path";

export const estimateTokens = (text: string) => Math.ceil(text.length / 4);

export interface ContextFile {
  readonly path: string;
  readonly tokens: number;
}

export interface ContextReport {
  readonly files: ReadonlyArray<ContextFile>;
  readonly totalTokens: number;
  readonly overBudget: ReadonlyArray<ContextFile>;
  readonly missing: ReadonlyArray<string>;
  readonly duplicates: ReadonlyArray<{ text: string; paths: ReadonlyArray<string> }>;
  readonly skills: ReadonlyArray<{ name: string; tokens: number }>;
}

interface AuditOptions {
  readonly fileBudgetTokens?: number;
  readonly skillsDir?: string;
}

// An import is an `@path` token at the start of a line; `\ ` escapes a space.
const IMPORT_LINE = /^@((?:\\ |\S)+)\s*$/;
const MIN_DUPLICATE_CHARS = 60;

const readSkills = (dir: string) => {
  if (!NodeFS.existsSync(dir)) return [];
  return NodeFS.readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .flatMap((entry) => {
      const file = NodePath.join(dir, entry.name, "SKILL.md");
      if (!NodeFS.existsSync(file)) return [];
      const description =
        /^description:\s*(.+)$/m.exec(NodeFS.readFileSync(file, "utf8"))?.[1] ?? "";
      return [{ name: entry.name, tokens: estimateTokens(entry.name + description) }];
    })
    .toSorted((a, b) => b.tokens - a.tokens);
};

export function auditContext(rootFile: string, options: AuditOptions = {}): ContextReport {
  const seen = new Map<string, string>();
  const missing: string[] = [];

  const visit = (file: string) => {
    const key = NodePath.resolve(file);
    if (seen.has(key)) return;
    const text = NodeFS.readFileSync(key, "utf8");
    seen.set(key, text);
    for (const line of text.split(/\r?\n/)) {
      const target = IMPORT_LINE.exec(line)?.[1]?.replaceAll("\\ ", " ");
      if (!target) continue;
      const resolved = NodePath.resolve(NodePath.dirname(key), target);
      if (NodeFS.existsSync(resolved)) visit(resolved);
      else missing.push(target);
    }
  };
  visit(rootFile);

  const files = [...seen].map(([path, text]) => ({ path, tokens: estimateTokens(text) }));
  const budget = options.fileBudgetTokens ?? 3000;

  const paragraphs = new Map<string, Set<string>>();
  for (const [path, text] of seen) {
    for (const raw of text.split(/\r?\n\s*\r?\n/)) {
      const paragraph = raw.trim();
      if (paragraph.length < MIN_DUPLICATE_CHARS || IMPORT_LINE.test(paragraph)) continue;
      paragraphs.set(paragraph, (paragraphs.get(paragraph) ?? new Set()).add(path));
    }
  }

  return {
    files,
    totalTokens: files.reduce((sum, f) => sum + f.tokens, 0),
    overBudget: files.filter((f) => f.tokens > budget),
    missing,
    duplicates: [...paragraphs]
      .filter(([, paths]) => paths.size > 1)
      .map(([text, paths]) => ({ text, paths: [...paths] })),
    skills: options.skillsDir ? readSkills(options.skillsDir) : [],
  };
}

if (import.meta.main) {
  const args = process.argv.slice(2);
  const flag = (name: string) => {
    const i = args.indexOf(name);
    return i === -1 ? undefined : args.splice(i, 2)[1];
  };
  const skillsDir = flag("--skills");
  const budget = flag("--budget");
  const report = auditContext(args[0] ?? "CLAUDE.md", {
    ...(skillsDir ? { skillsDir } : {}),
    ...(budget ? { fileBudgetTokens: Number(budget) } : {}),
  });
  const rows = report.files.toSorted((a, b) => b.tokens - a.tokens);
  console.log(`Instruction chain: ~${report.totalTokens} tokens in ${rows.length} files`);
  for (const f of rows) console.log(`  ${String(f.tokens).padStart(6)}  ${f.path}`);
  for (const f of report.overBudget) console.log(`OVER BUDGET  ${f.tokens}  ${f.path}`);
  for (const m of report.missing) console.log(`MISSING IMPORT  ${m}`);
  for (const d of report.duplicates) {
    console.log(
      `DUPLICATE (${d.paths.length} files): ${d.text.slice(0, 80).replaceAll(/\s+/g, " ")}...`,
    );
  }
  if (report.skills.length > 0) {
    const total = report.skills.reduce((sum, s) => sum + s.tokens, 0);
    console.log(`Skill descriptions: ~${total} tokens in ${report.skills.length} skills; top 5:`);
    for (const s of report.skills.slice(0, 5))
      console.log(`  ${String(s.tokens).padStart(6)}  ${s.name}`);
  }
}
