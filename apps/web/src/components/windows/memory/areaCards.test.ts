import { describe, expect, it } from "vite-plus/test";

import { areaCards } from "./areaCards";

const now = new Date(2026, 9, 21, 21, 0).getTime();
const minutes = (count: number) => now - count * 60_000;

const AREAS = [
  { id: "memory", units: 42, changedAt: minutes(300) },
  { id: "tasks", units: 118, changedAt: minutes(12) },
  { id: "logs", units: 42, changedAt: minutes(1) },
  { id: "recipes", units: 1, changedAt: minutes(2) },
];

describe("areaCards", () => {
  it("puts the biggest area first, then sorts equal counts by name", () => {
    expect(areaCards(AREAS, now).map((card) => card.id)).toEqual([
      "tasks",
      "logs",
      "memory",
      "recipes",
    ]);
  });

  it("writes the number, the unit word and the time in plain words", () => {
    expect(areaCards(AREAS, now)[0]).toEqual({
      id: "tasks",
      label: "Task cards",
      number: "118",
      unit: "cards",
      changed: "12 min ago",
      line: "118 cards · changed 12 min ago",
    });
  });

  it("uses the singular for one and says just now for a fresh change", () => {
    const [card] = areaCards([{ id: "memory", units: 1, changedAt: now - 5_000 }], now);
    expect(card).toMatchObject({ number: "1", unit: "note", changed: "just now" });
    expect(card?.line).toBe("1 note · changed just now");
  });

  it("groups thousands and does not change the list it was given", () => {
    const input = [...AREAS];
    expect(areaCards([{ id: "logs", units: 1234, changedAt: now }], now)[0]?.number).toBe("1,234");
    areaCards(input, now);
    expect(input).toEqual(AREAS);
  });

  it("returns nothing for no areas", () => {
    expect(areaCards([], now)).toEqual([]);
  });
});
