import type { ComponentType } from "react";

/** Which state fills the window: the Command Center, or Code with the Command Center as rails. */
export type TwoStateForward = "cc" | "code";

export interface SlotContext {
  readonly forward: TwoStateForward;
}

interface SlotBase {
  /** Unique inside its slot. */
  readonly id: string;
  /** Lower comes first. Built-in entries use steps of 10, so a plug-in can sit between them. */
  readonly order: number;
  readonly when?: (context: SlotContext) => boolean;
}

/** A Command Center home card. The card draws its own frame. */
export interface CardSlotEntry extends SlotBase {
  readonly Component: ComponentType;
}

/** A rail section. The rail draws the heading from `title`, the component draws the body. */
export interface RailSlotEntry extends SlotBase {
  readonly title: string;
  readonly Component: ComponentType;
}

/** A header stat. The header draws every stat the same way, so a plug-in gives only data. */
export interface StatSlotEntry extends SlotBase {
  readonly label: string;
  /** A React hook. The header calls it once per render in its own component. */
  readonly useValue: () => string | number | null;
}

export interface SlotEntries {
  readonly ccHome: CardSlotEntry;
  readonly leftRail: RailSlotEntry;
  readonly rightRail: RailSlotEntry;
  readonly headerStat: StatSlotEntry;
}

export type SlotName = keyof SlotEntries;

export type SlotModule = { readonly [K in SlotName]?: ReadonlyArray<SlotEntries[K]> };

export type SlotRegistry = { readonly [K in SlotName]: ReadonlyArray<SlotEntries[K]> };

const SLOT_NAMES: ReadonlyArray<SlotName> = ["ccHome", "leftRail", "rightRail", "headerStat"];

/**
 * Declares the entries of one `*.slot.tsx` file. Export the result as `slots`:
 * `export const slots = defineSlots({ ccHome: [...] })`.
 */
export const defineSlots = (module: SlotModule): SlotModule => module;

/** Joins every slot module. A repeated id in one slot keeps the first entry and is reported. */
export function collectSlots(modules: Record<string, { readonly slots?: SlotModule }>): {
  readonly registry: SlotRegistry;
  readonly duplicates: ReadonlyArray<string>;
} {
  const duplicates: string[] = [];
  const registry = {} as Record<SlotName, SlotBase[]>;
  const paths = Object.keys(modules).toSorted();
  for (const name of SLOT_NAMES) {
    const seen = new Set<string>();
    const entries: SlotBase[] = [];
    for (const path of paths) {
      for (const entry of modules[path]?.slots?.[name] ?? []) {
        if (seen.has(entry.id)) {
          duplicates.push(`${name}:${entry.id}`);
          continue;
        }
        seen.add(entry.id);
        entries.push(entry);
      }
    }
    registry[name] = entries.toSorted((a, b) => a.order - b.order || a.id.localeCompare(b.id));
  }
  return { registry: registry as unknown as SlotRegistry, duplicates };
}

export function entriesFor<K extends SlotName>(
  registry: SlotRegistry,
  slot: K,
  context: SlotContext,
): ReadonlyArray<SlotEntries[K]> {
  return registry[slot].filter((entry) => entry.when?.(context) ?? true);
}
