/**
 * The usage question comes after setup and its tour, so a new user's first screen is setup
 * itself. Users from the old setup get no tour, so they are asked once setup is done.
 */
export function shouldAskUsageConsent(input: {
  readonly consent: "unknown" | "granted" | "declined";
  readonly hydrated: boolean;
  readonly onboardingCompletedAt: string | null;
  /** True when the new 3-screen setup ran on this browser. */
  readonly setupStarted: boolean;
  readonly tourSeen: boolean;
}): boolean {
  if (input.consent !== "unknown" || !input.hydrated || input.onboardingCompletedAt === null) {
    return false;
  }
  return !input.setupStarted || input.tourSeen;
}
