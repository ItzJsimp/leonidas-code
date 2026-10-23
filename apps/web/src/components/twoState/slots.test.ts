import { describe, expect, it } from "vite-plus/test";

import { collectSlots, defineSlots, entriesFor, groupHomeEntries, type SlotModule } from "./slots";

const Card = () => null;
const ctx = { forward: "cc" } as const;

function modules(...list: SlotModule[]): Record<string, { slots?: SlotModule }> {
  return Object.fromEntries(list.map((slots, index) => [`/src/m${index}.slot.tsx`, { slots }]));
}

describe("collectSlots", () => {
  it("sorts each slot by order, then by id", () => {
    const { registry } = collectSlots(
      modules(
        defineSlots({ ccHome: [{ id: "b", order: 20, Component: Card }] }),
        defineSlots({
          ccHome: [
            { id: "c", order: 10, Component: Card },
            { id: "a", order: 20, Component: Card },
          ],
        }),
      ),
    );
    expect(entriesFor(registry, "ccHome", ctx).map((entry) => entry.id)).toEqual(["c", "a", "b"]);
  });

  it("keeps slots apart, so the same id can live in two slots", () => {
    const { registry, duplicates } = collectSlots(
      modules(
        defineSlots({
          leftRail: [{ id: "x", order: 1, title: "X", Component: Card }],
          headerStat: [{ id: "x", order: 1, label: "X", useValue: () => 3 }],
        }),
      ),
    );
    expect(duplicates).toEqual([]);
    expect(entriesFor(registry, "leftRail", ctx)).toHaveLength(1);
    expect(entriesFor(registry, "headerStat", ctx)[0]?.label).toBe("X");
    expect(entriesFor(registry, "rightRail", ctx)).toEqual([]);
  });

  it("reports a duplicate id in one slot and keeps the first entry", () => {
    const { registry, duplicates } = collectSlots(
      modules(
        defineSlots({ rightRail: [{ id: "feed", order: 1, title: "First", Component: Card }] }),
        defineSlots({ rightRail: [{ id: "feed", order: 0, title: "Second", Component: Card }] }),
      ),
    );
    expect(duplicates).toEqual(["rightRail:feed"]);
    expect(entriesFor(registry, "rightRail", ctx).map((entry) => entry.title)).toEqual(["First"]);
  });

  it("skips modules that export no slots", () => {
    const { registry } = collectSlots({ "/src/empty.slot.tsx": {} });
    expect(entriesFor(registry, "ccHome", ctx)).toEqual([]);
  });
});

describe("entriesFor", () => {
  it("hides an entry when its `when` returns false", () => {
    const { registry } = collectSlots(
      modules(
        defineSlots({
          ccHome: [
            { id: "always", order: 1, Component: Card },
            { id: "codeOnly", order: 2, Component: Card, when: (c) => c.forward === "code" },
          ],
        }),
      ),
    );
    expect(entriesFor(registry, "ccHome", { forward: "cc" }).map((e) => e.id)).toEqual(["always"]);
    expect(entriesFor(registry, "ccHome", { forward: "code" }).map((e) => e.id)).toEqual([
      "always",
      "codeOnly",
    ]);
  });
});

describe("groupHomeEntries", () => {
  it("puts neighbouring widgets in one group and keeps other cards alone", () => {
    const entry = (id: string, widget?: true) => ({
      id,
      order: 0,
      Component: Card,
      ...(widget ? { widget } : {}),
    });
    const groups = groupHomeEntries([
      entry("setup"),
      entry("a", true),
      entry("b", true),
      entry("direction"),
      entry("c", true),
    ]);
    expect(
      groups.map((group) =>
        group.kind === "card" ? group.entry.id : group.entries.map((e) => e.id).join("+"),
      ),
    ).toEqual(["setup", "a+b", "direction", "c"]);
  });
});
