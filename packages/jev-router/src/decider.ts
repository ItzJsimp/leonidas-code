import { JevClientProtocol } from "./typesafeClient.js";

export interface Decision {
  answer: string;
  prob: number;
  probs: Record<string, number>;
  confident: boolean;
  threshold: number;
  question: string;
}

export async function decide(
  client: JevClientProtocol,
  context: string,
  question: string,
  options: string[],
  threshold = 0.8,
): Promise<Decision> {
  if (!options.length) throw new Error("Options list cannot be empty");

  const probs = await client.choice(context, question, options);
  let bestAnswer = options[0];
  let maxProb = -1;

  for (const [opt, p] of Object.entries(probs)) {
    if (p > maxProb) {
      maxProb = p;
      bestAnswer = opt;
    }
  }

  return {
    answer: bestAnswer,
    prob: maxProb,
    probs,
    confident: maxProb >= threshold,
    threshold,
    question,
  };
}
