import type { OrchestrationV2TurnItem, ThreadSkillUse } from "@t3tools/contracts";
import { collectToolFilePaths } from "@t3tools/shared/toolActivity";

const SKILL_PATH = /(?:^|[\\/])skills[\\/]([^\\/]+)[\\/]SKILL\.md$/i;
const MENTION = /(?:^|\s)[/$]([a-zA-Z0-9][a-zA-Z0-9:_-]*)(?=\s|$)/g;
const ANNOUNCEMENT = /^Using [`]?([a-zA-Z0-9][a-zA-Z0-9:_-]*)[`]?:\s*(.+)$/gm;
const READ_COMMAND = /\b(?:Get-Content|cat|head|tail|sed|bat|type)\b/i;

function field(input: unknown, key: string): string | null {
  if (typeof input !== "object" || input === null || !(key in input)) return null;
  const value = (input as Record<string, unknown>)[key];
  return typeof value === "string" ? value : null;
}

function shellPaths(command: string): string[] {
  if (!READ_COMMAND.test(command)) return [];
  // Quoted paths can contain spaces. Bare paths cannot.
  const quoted = /["']([^"'\r\n]+SKILL\.md)["']/gi;
  const paths = [...command.matchAll(quoted)].map((m) => m[1]!);
  for (const token of command.replace(quoted, "").split(/[\s"';,]+/)) {
    if (SKILL_PATH.test(token)) paths.push(token);
  }
  return paths.filter((path) => SKILL_PATH.test(path));
}

/** Successful skill loads, with intent scoped to each run and steering message. */
export function deriveSkillUses(items: readonly OrchestrationV2TurnItem[]): ThreadSkillUse[] {
  const uses = new Map<string, ThreadSkillUse>();
  const manual = new Map<OrchestrationV2TurnItem["runId"], Set<string>>();
  const reasons = new Map<OrchestrationV2TurnItem["runId"], Map<string, string>>();
  const automaticLoads = new Map<OrchestrationV2TurnItem["runId"], Set<string>>();
  for (const item of items.toSorted((a, b) => a.ordinal - b.ordinal)) {
    if (item.type === "user_message") {
      const names = new Set([...item.text.matchAll(MENTION)].map((m) => m[1]!));
      for (const record of item.context?.records ?? []) {
        if (record.kind === "skill" && "name" in record && typeof record.name === "string") {
          names.add(record.name);
        }
      }
      manual.set(item.runId, names);
      reasons.delete(item.runId);
      automaticLoads.delete(item.runId);
      continue;
    }
    if (item.type === "assistant_message") {
      const runReasons = reasons.get(item.runId) ?? new Map<string, string>();
      for (const match of item.text.matchAll(ANNOUNCEMENT)) {
        const name = match[1]!;
        const reason = match[2]!.replace(/[`]$/, "").trim().slice(0, 240);
        runReasons.set(name, reason);
        const use = uses.get(name);
        if (use && automaticLoads.get(item.runId)?.has(name)) uses.set(name, { ...use, reason });
      }
      reasons.set(item.runId, runReasons);
      continue;
    }
    if (item.status !== "completed") continue;
    let names: string[] = [];
    let paths: string[] = [];
    if (
      item.type === "command_execution" &&
      (item.exitCode ?? 0) === 0 &&
      !item.outputIndicatesFailure
    ) {
      paths = shellPaths(item.input);
    } else if (item.type === "dynamic_tool") {
      const tool = item.toolName?.split(/__|\./).at(-1)?.toLowerCase() ?? "";
      if (tool === "skill") {
        const name = field(item.input, "skill");
        if (name) names.push(name);
      } else if (/^(?:read|view|read_file|open_file|read_text_file)$/.test(tool)) {
        paths = collectToolFilePaths(item.input);
      } else if (/^(?:exec_command|run_command|bash|shell|powershell)$/.test(tool)) {
        paths = shellPaths(field(item.input, "cmd") ?? field(item.input, "command") ?? "");
      }
    }
    const skillPaths = new Map<string, string>();
    for (const path of paths) {
      const name = SKILL_PATH.exec(path)?.[1];
      if (name) skillPaths.set(name, path);
    }
    names = [...new Set([...names, ...skillPaths.keys()])];
    for (const name of names) {
      const previous = uses.get(name);
      const origin: ThreadSkillUse["origins"][number] = manual.get(item.runId)?.has(name)
        ? "user"
        : "agent";
      if (origin === "agent") {
        const loaded = automaticLoads.get(item.runId) ?? new Set<string>();
        loaded.add(name);
        automaticLoads.set(item.runId, loaded);
      }
      uses.set(name, {
        name,
        origins: [...new Set([...(previous?.origins ?? []), origin])],
        path: skillPaths.get(name) ?? previous?.path ?? null,
        reason:
          (origin === "agent" ? reasons.get(item.runId)?.get(name) : null) ??
          previous?.reason ??
          null,
      });
    }
  }
  return [...uses.values()];
}
