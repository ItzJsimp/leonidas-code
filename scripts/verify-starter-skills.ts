// Installs every first-run starter skill into a brand-new scratch AIOS folder the
// same way the welcome wizard does, then checks each one lands in both skill roots
// and loads in Claude Code. `--list <folder>` reports what an AIOS folder has installed.
//
//   node scripts/verify-starter-skills.ts            install + file checks
//   node scripts/verify-starter-skills.ts --live     also ask Claude Code which skills it loaded
//   node scripts/verify-starter-skills.ts --list D:\MyAIOS
import * as NodeChildProcess from "node:child_process";
import * as NodeFS from "node:fs";
import * as NodeOS from "node:os";
import * as NodePath from "node:path";

import {
  CORE_SKILLS,
  SKILL_PACKS,
  SKILL_ROOTS,
  skillFiles,
  type BundledSkill,
} from "../apps/web/src/onboarding/skillPacks.ts";

// Claude Code's published SKILL.md limits.
const NAME_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const NAME_MAX = 64;
const DESCRIPTION_MAX = 1024;

interface Frontmatter {
  readonly name?: string;
  readonly description?: string;
}

function parseFrontmatter(text: string): Frontmatter | null {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n/.exec(text);
  if (!match) return null;
  const fields: Record<string, string> = {};
  for (const line of match[1]!.split(/\r?\n/)) {
    const field = /^([a-z-]+):\s*(.*)$/.exec(line);
    if (!field) return null;
    let value = field[2]!.trim();
    if (value.startsWith('"')) {
      if (!value.endsWith('"') || value.length < 2) return null;
      value = JSON.parse(value) as string;
    }
    fields[field[1]!] = value;
  }
  return fields;
}

function checkSkillFile(text: string, folderName: string): string[] {
  const problems: string[] = [];
  const frontmatter = parseFrontmatter(text);
  if (!frontmatter) return ["frontmatter missing or not parseable"];
  const { name, description } = frontmatter;
  if (name !== folderName) problems.push(`name "${name}" does not match folder "${folderName}"`);
  if (!name || !NAME_PATTERN.test(name) || name.length > NAME_MAX) {
    problems.push(`name "${name}" breaks the lowercase-hyphen, 64-character rule`);
  }
  if (!description) problems.push("description missing");
  else {
    if (description.length > DESCRIPTION_MAX) problems.push("description over 1024 characters");
    if (/[<>]/.test(description)) problems.push("description contains < or >");
  }
  if (text.replace(/^---[\s\S]*?\n---\r?\n/, "").trim().length === 0) problems.push("empty body");
  return problems;
}

/** Skill folders under each root of an AIOS folder, with any problems found. */
export function listInstalledSkills(folder: string) {
  const byName = new Map<string, { roots: string[]; problems: string[] }>();
  for (const root of SKILL_ROOTS) {
    const dir = NodePath.join(folder, root);
    if (!NodeFS.existsSync(dir)) continue;
    for (const entry of NodeFS.readdirSync(dir, { withFileTypes: true })) {
      if (!entry.isDirectory() && !entry.isSymbolicLink()) continue;
      const file = NodePath.join(dir, entry.name, "SKILL.md");
      const row = byName.get(entry.name) ?? { roots: [], problems: [] };
      if (NodeFS.existsSync(file)) {
        row.roots.push(root);
        for (const p of checkSkillFile(NodeFS.readFileSync(file, "utf8"), entry.name)) {
          row.problems.push(`${root}: ${p}`);
        }
      } else row.problems.push(`${root}: folder has no SKILL.md`);
      byName.set(entry.name, row);
    }
  }
  for (const [name, row] of byName) {
    for (const root of SKILL_ROOTS) {
      if (!row.roots.includes(root)) row.problems.push(`missing from ${root}`);
    }
    if (row.roots.length === SKILL_ROOTS.length) {
      const [a, b] = SKILL_ROOTS.map((root) =>
        NodeFS.readFileSync(NodePath.join(folder, root, name, "SKILL.md"), "utf8"),
      );
      if (a !== b) row.problems.push("the two copies differ");
    }
  }
  return [...byName].toSorted(([a], [b]) => a.localeCompare(b));
}

function printList(folder: string): number {
  const rows = listInstalledSkills(folder);
  if (rows.length === 0) {
    console.log(`No skills found under ${SKILL_ROOTS.join(" or ")} in ${folder}`);
    return 1;
  }
  let bad = 0;
  for (const [name, row] of rows) {
    const ok = row.problems.length === 0;
    if (!ok) bad++;
    console.log(`${ok ? "OK  " : "FAIL"} ${name.padEnd(28)} ${row.roots.join(", ")}`);
    for (const problem of row.problems) console.log(`       ${problem}`);
  }
  console.log(`\n${rows.length} skills, ${bad} with problems (${folder})`);
  return bad === 0 ? 0 : 1;
}

// Fixed command lines with no user input, so a shell string is safe; Windows needs the
// shell to resolve the .cmd shims.
function run(command: string, folder: string) {
  return NodeChildProcess.spawnSync(command, {
    cwd: folder,
    encoding: "utf8",
    shell: true,
    timeout: 120_000,
    maxBuffer: 64 * 1024 * 1024,
  });
}

/** Asks Claude Code, run inside the folder, which skills it discovered at session start (one tiny haiku call). */
function claudeLoadedSkills(folder: string): Set<string> | string {
  const result = run(
    'claude -p "Reply with OK." --output-format stream-json --verbose --max-turns 1 --model haiku',
    folder,
  );
  if (result.error) return `claude could not start: ${result.error.message}`;
  for (const line of result.stdout.split(/\r?\n/)) {
    if (!line.startsWith("{")) continue;
    const event = JSON.parse(line) as {
      type?: string;
      subtype?: string;
      skills?: string[];
      slash_commands?: string[];
    };
    if (event.type === "system" && event.subtype === "init") {
      return new Set([...(event.skills ?? []), ...(event.slash_commands ?? [])]);
    }
  }
  return `no init event from claude (exit ${result.status}): ${result.stderr.slice(0, 300)}`;
}

/** Renders the prompt Codex would send (no model call) and keeps skills read from this folder. */
function codexLoadedSkills(folder: string): Set<string> | string {
  const result = run("codex debug prompt-input", folder);
  if (result.error) return `codex could not start: ${result.error.message}`;
  const text = result.stdout.replaceAll("\\\\", "/").replaceAll("\\", "/");
  const want = NodePath.join(folder, ".agents", "skills").replaceAll("\\", "/").toLowerCase();
  // Codex lists skill roots as aliases (`r7` = `<path>`), then skills as `(file: r7/<name>/SKILL.md)`.
  const alias = [...text.matchAll(/`(r\d+)` = `([^`]+)`/g)].find(
    (match) => match[2]!.toLowerCase() === want,
  )?.[1];
  if (!alias) return `codex did not read ${want} (exit ${result.status})`;
  const names = [...text.matchAll(new RegExp(`\\(file: ${alias}/([a-z0-9-]+)/SKILL\\.md\\)`, "g"))];
  return new Set(names.map((match) => match[1]!));
}

function reportLive(engine: string, loaded: Set<string> | string, skills: readonly BundledSkill[]) {
  if (typeof loaded === "string") {
    console.log(`${engine}: check failed, ${loaded}`);
    return false;
  }
  const missing = skills.filter((skill) => !loaded.has(skill.name)).map((skill) => skill.name);
  console.log(
    `${engine} loaded ${skills.length - missing.length}/${skills.length} starter skills` +
      (missing.length ? `; missing: ${missing.join(", ")}` : ""),
  );
  return missing.length === 0;
}

function main(argv: readonly string[]): number {
  const listIndex = argv.indexOf("--list");
  if (listIndex >= 0) {
    const folder = argv[listIndex + 1];
    if (!folder) {
      console.error("Usage: --list <AIOS folder>");
      return 2;
    }
    return printList(NodePath.resolve(folder));
  }

  const skills: BundledSkill[] = [...CORE_SKILLS, ...Object.values(SKILL_PACKS).flat()];
  const folder = NodeFS.mkdtempSync(NodePath.join(NodeOS.tmpdir(), "leonidas-starter-skills-"));
  console.log(`Scratch AIOS folder: ${folder}\nInstalling ${skills.length} skills\n`);
  // Mirrors the wizard: every skill, every root, parent folders created on write.
  for (const skill of skills) {
    for (const root of SKILL_ROOTS) {
      for (const file of skillFiles(skill, root)) {
        const target = NodePath.join(folder, file.relativePath);
        NodeFS.mkdirSync(NodePath.dirname(target), { recursive: true });
        NodeFS.writeFileSync(target, file.contents);
      }
    }
  }

  let exitCode = printList(folder);
  const installed = new Set(listInstalledSkills(folder).map(([name]) => name));
  for (const skill of skills) {
    if (!installed.has(skill.name)) {
      console.log(`FAIL ${skill.name}: not written`);
      exitCode = 1;
    }
  }

  if (argv.includes("--live")) {
    console.log("");
    if (!reportLive("Claude Code", claudeLoadedSkills(folder), skills)) exitCode = 1;
    if (!reportLive("Codex", codexLoadedSkills(folder), skills)) exitCode = 1;
  }
  return exitCode;
}

process.exitCode = main(process.argv.slice(2));
