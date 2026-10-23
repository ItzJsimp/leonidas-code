import {
  collectSlots,
  entriesFor,
  groupHomeEntries,
  type SlotContext,
  type SlotModule,
} from "./slots";

// Any `*.slot.tsx` file under components/ plugs in here, so a new card needs no edit to this folder.
const found = collectSlots(
  import.meta.glob<{ slots?: SlotModule }>("../**/*.slot.tsx", { eager: true }),
);
if (found.duplicates.length > 0) {
  const message = `Slot ids are used twice: ${found.duplicates.join(", ")}`;
  if (import.meta.env.DEV) throw new Error(message);
  console.error(message);
}

export const slotRegistry = found.registry;

/**
 * Draws every Command Center home card in order. Widgets flow down columns as wide as the room
 * allows (one at 390 px, two in the split, three alone), so no widget is cut or hidden.
 */
export function HomeCardsOutlet({ context }: { readonly context: SlotContext }) {
  return groupHomeEntries(entriesFor(slotRegistry, "ccHome", context)).map((group) =>
    group.kind === "card" ? (
      <group.entry.Component key={group.entry.id} />
    ) : (
      <div key={group.entries[0]?.id} className="-mb-3 columns-[18.75rem] gap-3">
        {group.entries.map(({ id, Component }) => (
          <div key={id} className="mb-3 break-inside-avoid">
            <Component />
          </div>
        ))}
      </div>
    ),
  );
}
