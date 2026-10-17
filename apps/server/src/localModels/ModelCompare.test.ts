import { LocalModelsError } from "@t3tools/contracts";
import { describe, expect, it } from "vite-plus/test";

import { ModelCompare } from "./ModelCompare.ts";

function setup(random: number) {
  const saved: string[] = [];
  const asked: string[] = [];
  let id = 0;
  const compare = new ModelCompare({
    answer: async (model) => {
      asked.push(model);
      return { text: `answer number ${String(asked.length)}`, tokensPerSecond: 50, seconds: 2 };
    },
    random: () => random,
    newId: () => `c${String((id += 1))}`,
    now: () => 1000,
    savePick: (line) => saved.push(line),
  });
  return { compare, saved, asked };
}

const input = { prompt: "Say hi", modelA: "m1", modelB: "m2" };

describe("ModelCompare", () => {
  it("hides the model names until the pick and reveals the swapped mapping", async () => {
    const { compare, asked } = setup(0.1);
    const result = await compare.compare(input);
    expect(JSON.stringify(result)).not.toMatch(/m1|m2/);
    expect(asked).toEqual(["m2", "m1"]);
    const revealed = compare.pick({ compareId: result.compareId, pick: "A" });
    expect(revealed.models).toEqual({ A: "m2", B: "m1" });
    expect(revealed.winner).toBe("m2");
  });

  it("keeps the order when the coin lands the other way", async () => {
    const { compare } = setup(0.9);
    const result = await compare.compare(input);
    expect(compare.pick({ compareId: result.compareId, pick: "B" }).winner).toBe("m2");
  });

  it("saves one JSON line per pick and a tie has no winner", async () => {
    const { compare, saved } = setup(0.9);
    const result = await compare.compare(input);
    compare.pick({ compareId: result.compareId, pick: "tie" });
    expect(saved).toHaveLength(1);
    expect(JSON.parse(saved[0]!)).toMatchObject({ modelA: "m1", modelB: "m2", winner: null });
  });

  it("accepts a pick only once and rejects the same model twice", async () => {
    const { compare } = setup(0.9);
    const result = await compare.compare(input);
    compare.pick({ compareId: result.compareId, pick: "A" });
    expect(() => compare.pick({ compareId: result.compareId, pick: "A" })).toThrow(
      LocalModelsError,
    );
    await expect(compare.compare({ ...input, modelB: "m1" })).rejects.toThrow(LocalModelsError);
  });
});
