import { useSyncExternalStore } from "react";

/**
 * Dev-only switch for the new-user onboarding simulation. `?sim=onboarding`
 * turns it on for this browser profile until the user exits it; `?sim=off`
 * turns it off. Read at boot (before the router redirects and drops the query)
 * and never active in production builds.
 */
const SIM_FLAG_KEY = "leonidas:onboarding-sim";
const listeners = new Set<() => void>();

export function captureOnboardingSimRequest(): void {
  if (!import.meta.env.DEV) return;
  const request = new URLSearchParams(window.location.search).get("sim");
  if (request === "onboarding") localStorage.setItem(SIM_FLAG_KEY, "on");
  else if (request === "off") localStorage.removeItem(SIM_FLAG_KEY);
}

function readFlag(): boolean {
  return import.meta.env.DEV && localStorage.getItem(SIM_FLAG_KEY) === "on";
}

export function setOnboardingSimActive(active: boolean): void {
  if (active) localStorage.setItem(SIM_FLAG_KEY, "on");
  else localStorage.removeItem(SIM_FLAG_KEY);
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useOnboardingSimActive(): boolean {
  return useSyncExternalStore(subscribe, readFlag, () => false);
}
