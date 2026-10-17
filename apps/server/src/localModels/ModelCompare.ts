/**
 * Blind compare of two local models. One prompt goes to both models. The person sees the
 * answers as A and B, picks the better one, and only then sees which model wrote which.
 * The mapping stays on the server until the pick. Each pick is saved as one line of JSON.
 */
import {
  LocalModelsError,
  type LocalModelsCompareInput,
  type LocalModelsCompareResult,
  type LocalModelsPickInput,
  type LocalModelsPickResult,
} from "@t3tools/contracts";

export interface ModelAnswer {
  readonly text: string;
  readonly tokensPerSecond: number | null;
  readonly seconds: number;
}

export interface ModelCompareDeps {
  /** Ask one installed model. Runs one model at a time, so a small graphics card is enough. */
  readonly answer: (model: string, prompt: string) => Promise<ModelAnswer>;
  readonly random: () => number;
  readonly newId: () => string;
  readonly now: () => number;
  readonly savePick: (line: string) => void;
}

interface Pending {
  readonly prompt: string;
  readonly models: { readonly A: string; readonly B: string };
}

/** Keep only the latest comparisons, so a long session cannot grow the map without limit. */
const MAX_PENDING = 20;

export class ModelCompare {
  private readonly pending = new Map<string, Pending>();

  private readonly deps: ModelCompareDeps;

  constructor(deps: ModelCompareDeps) {
    this.deps = deps;
  }

  async compare(input: LocalModelsCompareInput): Promise<LocalModelsCompareResult> {
    if (input.modelA === input.modelB) {
      throw new LocalModelsError({
        reason: "invalid_input",
        detail: "Choose two different models.",
      });
    }
    // A coin flip hides which model is A. The result never names a model.
    const swap = this.deps.random() < 0.5;
    const models = swap
      ? { A: input.modelB, B: input.modelA }
      : { A: input.modelA, B: input.modelB };
    const first = await this.deps.answer(models.A, input.prompt);
    const second = await this.deps.answer(models.B, input.prompt);
    const compareId = this.deps.newId();
    this.pending.set(compareId, { prompt: input.prompt, models });
    while (this.pending.size > MAX_PENDING) {
      const oldest = this.pending.keys().next().value;
      if (oldest === undefined) break;
      this.pending.delete(oldest);
    }
    return {
      compareId,
      answers: [
        { label: "A", ...first },
        { label: "B", ...second },
      ],
    };
  }

  pick(input: LocalModelsPickInput): LocalModelsPickResult {
    const entry = this.pending.get(input.compareId);
    if (entry === undefined) {
      throw new LocalModelsError({
        reason: "not_found",
        detail: "This comparison is no longer open. Run it again.",
      });
    }
    this.pending.delete(input.compareId);
    const winner = input.pick === "tie" ? null : entry.models[input.pick === "A" ? "A" : "B"];
    this.deps.savePick(
      JSON.stringify({
        at: this.deps.now(),
        prompt: entry.prompt,
        modelA: entry.models.A,
        modelB: entry.models.B,
        pick: input.pick,
        winner,
      }),
    );
    return { models: entry.models, winner };
  }
}
