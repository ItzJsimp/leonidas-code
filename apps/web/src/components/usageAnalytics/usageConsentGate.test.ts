import { describe, expect, it } from "vite-plus/test";

import { shouldAskUsageConsent } from "./usageConsentGate";

const base = {
  consent: "unknown" as const,
  hydrated: true,
  onboardingCompletedAt: "2026-10-24T09:00:00Z",
  setupStarted: true,
  tourSeen: true,
};

describe("shouldAskUsageConsent", () => {
  it("waits until setup is finished, so it is never the first screen", () => {
    expect(shouldAskUsageConsent({ ...base, onboardingCompletedAt: null })).toBe(false);
    expect(shouldAskUsageConsent({ ...base, hydrated: false })).toBe(false);
  });

  it("waits for the tour when the new setup ran", () => {
    expect(shouldAskUsageConsent({ ...base, tourSeen: false })).toBe(false);
    expect(shouldAskUsageConsent(base)).toBe(true);
  });

  it("asks users from the old setup, who get no tour", () => {
    expect(shouldAskUsageConsent({ ...base, setupStarted: false, tourSeen: false })).toBe(true);
  });

  it("never asks twice", () => {
    expect(shouldAskUsageConsent({ ...base, consent: "granted" })).toBe(false);
    expect(shouldAskUsageConsent({ ...base, consent: "declined" })).toBe(false);
  });
});
