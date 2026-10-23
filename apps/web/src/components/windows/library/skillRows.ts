import type { ServerProviderSkill } from "@t3tools/contracts";
import { formatProviderSkillDisplayName } from "@t3tools/shared/inlineSkills";

import { LEONIDAS_GOALS } from "~/onboarding/leonidasSetup.logic";
import { SKILL_PACKS } from "~/onboarding/skillPacks";
import { searchProviderSkills } from "~/providerSkillSearch";

export interface SkillRow {
  readonly key: string;
  readonly name: string;
  /** One plain line: the short description, else the first line of the description. */
  readonly line: string;
}

const firstLine = (text: string) => text.split(/\r?\n/, 1)[0]?.trim() ?? "";

/** The skills the composer lists (usable, once each, best match first), as rows. */
export function skillRows(skills: readonly ServerProviderSkill[], query: string): SkillRow[] {
  return searchProviderSkills(skills, query).map((skill) => ({
    key: skill.name,
    name: formatProviderSkillDisplayName(skill),
    line: firstLine(skill.shortDescription ?? skill.description ?? "") || "No description yet.",
  }));
}

export interface PackRow {
  readonly id: string;
  readonly label: string;
  readonly hint: string;
  readonly skills: ReadonlyArray<{ readonly name: string; readonly line: string }>;
}

/** The starter packs from the welcome steps, one per goal, read only. */
export function packRows(): PackRow[] {
  return LEONIDAS_GOALS.flatMap((goal) => {
    const pack = Object.hasOwn(SKILL_PACKS, goal.id) ? SKILL_PACKS[goal.id] : undefined;
    return pack && pack.length > 0
      ? [
          {
            id: goal.id,
            label: goal.label,
            hint: goal.hint,
            skills: pack.map((skill) => ({ name: skill.name, line: firstLine(skill.description) })),
          },
        ]
      : [];
  });
}
