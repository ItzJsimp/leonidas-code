import { RailPanel } from "./RailParts";
import { collectSlots, entriesFor, type SlotContext, type SlotModule } from "./slots";

const CODE_CONTEXT: SlotContext = { forward: "code" };

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

/** Draws every Command Center home card in order. */
export function HomeCardsOutlet({ context }: { readonly context: SlotContext }) {
  return entriesFor(slotRegistry, "ccHome", context).map(({ id, Component }) => (
    <Component key={id} />
  ));
}

/** Plug-in rail sections, each in the shared rail frame. */
export function RailSlotSections({ slot }: { readonly slot: "leftRail" | "rightRail" }) {
  return entriesFor(slotRegistry, slot, CODE_CONTEXT).map(({ id, title, Component }) => (
    <RailPanel key={id} title={title}>
      <Component />
    </RailPanel>
  ));
}
