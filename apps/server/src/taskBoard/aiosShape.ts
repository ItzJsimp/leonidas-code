import * as NodeFS from "node:fs";
import * as NodePath from "node:path";

export interface AiosShape {
  readonly aiosDetected: boolean;
  readonly skillsCount: number;
  readonly taskCardsCount: number;
  readonly memoryFilesPresent: boolean;
}

const EMPTY_SHAPE: AiosShape = {
  aiosDetected: false,
  skillsCount: 0,
  taskCardsCount: 0,
  memoryFilesPresent: false,
};

const listDir = (dir: string): NodeFS.Dirent[] => {
  try {
    return NodeFS.readdirSync(dir, { withFileTypes: true });
  } catch {
    return [];
  }
};

const isMarkdown = (entry: NodeFS.Dirent) => entry.name.toLowerCase().endsWith(".md");

/** Counts only: how big the user's AIOS is. No names, titles or paths leave this function. */
export function readAiosShape(root: string | null): AiosShape {
  if (root === null) return EMPTY_SHAPE;
  const skillsDir = [".agents/skills", ".claude/skills"]
    .map((rel) => NodePath.join(root, rel))
    .find((dir) => listDir(dir).length > 0);
  const skillsCount =
    skillsDir === undefined
      ? 0
      : listDir(skillsDir).filter((entry) =>
          NodeFS.existsSync(NodePath.join(skillsDir, entry.name, "SKILL.md")),
        ).length;
  return {
    aiosDetected: true,
    skillsCount,
    taskCardsCount: listDir(NodePath.join(root, "tasks")).filter(
      (entry) => entry.isFile() && isMarkdown(entry),
    ).length,
    memoryFilesPresent: listDir(NodePath.join(root, "memory")).some(isMarkdown),
  };
}
