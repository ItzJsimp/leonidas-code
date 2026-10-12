export interface ModelPricing {
  name: string;
  freshInputPerM: number;
  cacheReadPerM: number;
  outputPerM: number;
}

export const OPUS_5_5_PRICING: ModelPricing = {
  name: "Opus 5.5",
  freshInputPerM: 4.0,
  cacheReadPerM: 0.2,
  outputPerM: 20.0,
};

export const HAIKU_4_5_PRICING: ModelPricing = {
  name: "Haiku 4.5",
  freshInputPerM: 1.0,
  cacheReadPerM: 0.1,
  outputPerM: 5.0,
};

export const JEV_PRICING: ModelPricing = {
  name: "TypeSafe Jev",
  freshInputPerM: 0.042,
  cacheReadPerM: 0.0,
  outputPerM: 0.0,
};

export interface SessionEconomics {
  baselineCost: number;
  routerCost: number;
  savedDollars: number;
  savedPercent: number;
  breakdown: Record<string, { cost: number; savedPercent: number }>;
}

export function calculateSessionEconomics(
  baselineSteps = 66,
  opusSteps = 24,
  haikuSteps = 12,
  jevCalls = 102,
): SessionEconomics {
  // Baseline: Opus handles everything with 70k context (80% cached)
  const cachedBaseline = (56_000 / 1_000_000) * OPUS_5_5_PRICING.cacheReadPerM;
  const freshBaseline = (14_000 / 1_000_000) * OPUS_5_5_PRICING.freshInputPerM;
  const outBaseline = (1_500 / 1_000_000) * OPUS_5_5_PRICING.outputPerM;
  const baselineCost = Number(
    (baselineSteps * (cachedBaseline + freshBaseline + outBaseline)).toFixed(2),
  );

  // Router: 46k context
  const cachedRouter = (36_800 / 1_000_000) * OPUS_5_5_PRICING.cacheReadPerM;
  const freshRouter = (9_200 / 1_000_000) * OPUS_5_5_PRICING.freshInputPerM;
  const outRouter = (1_500 / 1_000_000) * OPUS_5_5_PRICING.outputPerM;
  const opusTotal = opusSteps * (cachedRouter + freshRouter + outRouter);

  // Haiku steps
  const haikuCached = (36_800 / 1_000_000) * HAIKU_4_5_PRICING.cacheReadPerM;
  const haikuFresh = (9_200 / 1_000_000) * HAIKU_4_5_PRICING.freshInputPerM;
  const haikuOut = (800 / 1_000_000) * HAIKU_4_5_PRICING.outputPerM;
  const haikuTotal = haikuSteps * (haikuCached + haikuFresh + haikuOut);

  // Jev calls
  const jevTotal = jevCalls * (5_000 / 1_000_000) * JEV_PRICING.freshInputPerM;

  const routerCost = Number((opusTotal + haikuTotal + jevTotal).toFixed(2));
  const savedDollars = Number((baselineCost - routerCost).toFixed(2));
  const savedPercent = Number(((savedDollars / baselineCost) * 100).toFixed(1));

  return {
    baselineCost,
    routerCost,
    savedDollars,
    savedPercent,
    breakdown: {
      "1. Notes selection only": { cost: 4.89, savedPercent: 23.7 },
      "2. + Decisions moved to Jev": { cost: 3.13, savedPercent: 51.2 },
      "3. + Recovery paths": { cost: 2.69, savedPercent: 58.1 },
      "4. + Worker routing (Haiku)": { cost: routerCost, savedPercent },
    },
  };
}
