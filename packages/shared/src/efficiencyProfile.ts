/**
 * Efficiency profile: one switch for how the composer spends tokens. Today it sets the
 * Autorouter goal; Balanced leaves the model the user picked alone. Reasoning effort and
 * compaction are per-model and per-account settings, so they stay where they are.
 */
import type { AutoRoutePreference, EfficiencyProfile } from "@t3tools/contracts/settings";

export interface EfficiencyProfileDetails {
  readonly label: string;
  readonly description: string;
  /** Null means no routing: the composer uses the picked model. */
  readonly routePreference: AutoRoutePreference | null;
}

export const EFFICIENCY_PROFILES: Record<EfficiencyProfile, EfficiencyProfileDetails> = {
  economy: {
    label: "Economy",
    description: "Routes each message to the cheapest model that fits the task.",
    routePreference: "cost",
  },
  balanced: {
    label: "Balanced",
    description: "Uses the model you pick. No automatic routing.",
    routePreference: null,
  },
  max: {
    label: "Max",
    description: "Routes each message to the strongest model available.",
    routePreference: "quality",
  },
};
