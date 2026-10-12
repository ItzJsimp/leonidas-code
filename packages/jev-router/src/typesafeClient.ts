/**
 * TypeSafe Jev Client & Interfaces for TypeScript.
 *
 * Connects to TypeSafe AI System-1 API (jev-latest) or falls back to
 * smart semantic heuristics for local testing and offline execution.
 */

export interface JevClientProtocol {
  choice(context: string, question: string, options: string[]): Promise<Record<string, number>>;
  boolean(context: string, question: string): Promise<number>;
}

export class TypeSafeJevClient implements JevClientProtocol {
  private apiKey: string;
  private baseUrl: string;
  private model: string;

  constructor(options?: { apiKey?: string; baseUrl?: string; model?: string }) {
    this.apiKey = options?.apiKey || process.env.TYPESAFE_API_KEY || process.env.JEV_API_KEY || "";
    this.baseUrl = (
      options?.baseUrl ||
      process.env.TYPESAFE_API_URL ||
      "https://api.typesafe.ai/v1/systemone"
    ).replace(/\/$/, "");
    this.model = options?.model || "jev-latest";
  }

  async choice(
    context: string,
    question: string,
    options: string[],
  ): Promise<Record<string, number>> {
    if (!options.length) throw new Error("Options cannot be empty");
    if (options.length === 1) return { [options[0]]: 1.0 };

    if (!this.apiKey) {
      return new MockJevClient().choice(context, question, options);
    }

    try {
      const response = await fetch(this.baseUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
          "User-Agent": "Leonidas-JevRouter-TS/1.0",
        },
        body: JSON.stringify({
          model: this.model,
          state: context,
          questions: {
            decision: {
              type: "choice",
              instructions: question,
              choices: options,
            },
          },
        }),
      });

      if (!response.ok) {
        return new MockJevClient().choice(context, question, options);
      }

      const data = (await response.json()) as any;
      const rawProbs =
        data?.answers?.decision?.probabilities || data?.answers?.decision?.choices || {};

      const result: Record<string, number> = {};
      let total = 0;
      for (const opt of options) {
        const val = Number(rawProbs[opt] || 0);
        result[opt] = val;
        total += val;
      }

      if (total > 0) {
        for (const opt of options) {
          result[opt] = Number((result[opt] / total).toFixed(4));
        }
        return result;
      }

      const uniform = Number((1 / options.length).toFixed(4));
      return Object.fromEntries(options.map((opt) => [opt, uniform]));
    } catch {
      return new MockJevClient().choice(context, question, options);
    }
  }

  async boolean(context: string, question: string): Promise<number> {
    const res = await this.choice(context, question, ["true", "false"]);
    return res["true"] ?? 0.5;
  }
}

export class MockJevClient implements JevClientProtocol {
  private overrides: Record<string, Record<string, number>>;

  constructor(overrides: Record<string, Record<string, number>> = {}) {
    this.overrides = overrides;
  }

  async choice(
    context: string,
    question: string,
    options: string[],
  ): Promise<Record<string, number>> {
    // Check overrides
    for (const [pattern, dist] of Object.entries(this.overrides)) {
      if (context.includes(pattern) || question.includes(pattern)) {
        return this.normalize(dist, options);
      }
    }

    const qLower = question.toLowerCase();
    const cLower = context.toLowerCase();

    // 1. Notes selection
    if (qLower.includes("need this note")) {
      const isRelevant = ["rate limit", "auth", "redis", "token", "middleware", "test"].some((kw) =>
        cLower.includes(kw),
      );
      const prob = isRelevant ? 0.92 : 0.08;
      return { needed: prob, not_needed: Number((1 - prob).toFixed(4)) };
    }

    // 2. Routing
    if (qLower.includes("what kind of work")) {
      let target = "new_logic";
      if (cLower.includes("rename") || cLower.includes("move")) target = "rename_or_move";
      else if (cLower.includes("add field") || cLower.includes("small edit"))
        target = "small_edit_following_existing_pattern";
      else if (cLower.includes("debug") || cLower.includes("stack trace")) target = "debugging";
      else if (cLower.includes("architecture") || cLower.includes("design"))
        target = "design_decision";

      const dist: Record<string, number> = Object.fromEntries(options.map((o) => [o, 0.02]));
      dist[target] = 0.92;
      return this.normalize(dist, options);
    }

    // 3. Recovery
    if (qLower.includes("next move after this failure")) {
      let target = "escalate_to_opus";
      if (
        cLower.includes("cannot find module") ||
        cLower.includes("no module named") ||
        cLower.includes("not recognized")
      ) {
        target = "retry_after_install";
      } else if (cLower.includes("enoent") || cLower.includes("no such file")) {
        target = "fix_path_and_retry";
      } else if (cLower.includes("timeout") || cLower.includes("econnreset")) {
        target = "retry_unchanged";
      }
      const dist: Record<string, number> = Object.fromEntries(options.map((o) => [o, 0.02]));
      dist[target] = 0.94;
      return this.normalize(dist, options);
    }

    // 4. Tests
    if (qLower.includes("break tests in this file")) {
      const match = ["auth", "signup", "limiter", "token"].some((kw) => cLower.includes(kw));
      const p = match ? 0.91 : 0.06;
      return { likely: p, unlikely: Number((1 - p).toFixed(4)) };
    }

    const uniform = Number((1 / options.length).toFixed(4));
    return Object.fromEntries(options.map((o) => [o, uniform]));
  }

  async boolean(context: string, question: string): Promise<number> {
    const res = await this.choice(context, question, ["true", "false"]);
    return res["true"] ?? 0.5;
  }

  private normalize(dist: Record<string, number>, options: string[]): Record<string, number> {
    const raw = Object.fromEntries(options.map((opt) => [opt, dist[opt] ?? 0.01]));
    const total = Object.values(raw).reduce((a, b) => a + b, 0);
    return Object.fromEntries(options.map((opt) => [opt, Number((raw[opt] / total).toFixed(4))]));
  }
}
