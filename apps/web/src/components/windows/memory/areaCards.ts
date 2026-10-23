import type { TaskBoardHomeArea } from "@t3tools/contracts";

import { areaLabel, areaUnitWord, changedLabel } from "~/components/twoState/areaRows";

export interface AreaCard {
  readonly id: string;
  readonly label: string;
  /** The big number, with thousands grouped. */
  readonly number: string;
  /** The word under the number: "cards", "note". */
  readonly unit: string;
  /** "12 min ago" or "just now". */
  readonly changed: string;
  /** "118 cards · changed 12 min ago". */
  readonly line: string;
}

function toCard(area: TaskBoardHomeArea, now: number): AreaCard {
  const number = area.units.toLocaleString("en-US");
  const unit = areaUnitWord(area.id, area.units);
  const changed = changedLabel(area.changedAt, now);
  return {
    id: area.id,
    label: areaLabel(area.id),
    number,
    unit,
    changed,
    line: `${number} ${unit} · changed ${changed}`,
  };
}

/** One card per area, the biggest first, equal counts by name. */
export function areaCards(areas: readonly TaskBoardHomeArea[], now: number): AreaCard[] {
  return [...areas]
    .sort((a, b) => b.units - a.units || areaLabel(a.id).localeCompare(areaLabel(b.id)))
    .map((area) => toCard(area, now));
}

export function areaCard(
  areas: readonly TaskBoardHomeArea[],
  id: string,
  now: number,
): AreaCard | null {
  const area = areas.find((candidate) => candidate.id === id);
  return area ? toCard(area, now) : null;
}

/** The count line for a tab that has no list yet: what is kept and when it changed. */
export function folderAreaLine(
  areas: readonly TaskBoardHomeArea[],
  id: string,
  now: number,
): string {
  const card = areaCard(areas, id, now);
  return card
    ? `Leonidas keeps ${card.number} ${card.unit}. Last change ${card.changed}.`
    : "Nothing is counted here yet.";
}
