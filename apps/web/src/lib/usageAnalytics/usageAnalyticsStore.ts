import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { resolveStorage } from "../storage";

/**
 * Bump when an event adds a data category the dialog did not list. The persist
 * migration below then turns older "granted" answers back into "unknown", so the
 * user is asked again. Version 2: setup steps, AIOS counts, providers, errors.
 */
export const USAGE_CONSENT_VERSION = 2;

export type UsageConsent = "unknown" | "granted" | "declined";

interface UsageAnalyticsState {
  /** Random id made on this machine. Not linked to a name, email or account. */
  installId: string;
  installedAt: number;
  consent: UsageConsent;
  /** Optional name a tester types so the owner can tell friends apart. */
  friendLabel: string;
  firstRunSent: boolean;
  setupSent: boolean;
  /** Epoch ms when the welcome wizard finished; set by the coordinator. */
  setupDoneAt: number | null;
  firstMessageSent: boolean;
  /** App version seen at the last launch; a change means an update was installed. */
  lastAppVersion: string;
  /** True while a session is open; still true at next launch means it did not close cleanly. */
  sessionOpen: boolean;
  launchCount: number;
  setConsent: (consent: UsageConsent) => void;
  setFriendLabel: (label: string) => void;
  markFirstRunSent: () => void;
  markSetupSent: (doneAt: number) => void;
  markFirstMessageSent: () => void;
  setLastAppVersion: (version: string) => void;
  setSessionOpen: (open: boolean) => void;
  countLaunch: () => number;
}

function makeInstallId(): string {
  return (
    globalThis.crypto?.randomUUID?.() ??
    `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
  );
}

/** Per machine. The store lives in local storage; nothing leaves it until consent is granted. */
export const useUsageAnalyticsStore = create<UsageAnalyticsState>()(
  persist(
    (set, get) => ({
      installId: makeInstallId(),
      installedAt: Date.now(),
      consent: "unknown",
      friendLabel: "",
      firstRunSent: false,
      setupSent: false,
      setupDoneAt: null,
      firstMessageSent: false,
      lastAppVersion: "",
      sessionOpen: false,
      launchCount: 0,
      setConsent: (consent) => set({ consent }),
      setFriendLabel: (friendLabel) => set({ friendLabel: friendLabel.slice(0, 40) }),
      markFirstRunSent: () => set({ firstRunSent: true }),
      markSetupSent: (setupDoneAt) => set({ setupSent: true, setupDoneAt }),
      markFirstMessageSent: () => set({ firstMessageSent: true }),
      setLastAppVersion: (lastAppVersion) => set({ lastAppVersion }),
      setSessionOpen: (sessionOpen) => set({ sessionOpen }),
      countLaunch: () => {
        const launchCount = get().launchCount + 1;
        set({ launchCount });
        return launchCount;
      },
    }),
    {
      name: "leonidas:usage-analytics:v1",
      version: USAGE_CONSENT_VERSION,
      migrate: (persisted) => {
        const state = persisted as Partial<UsageAnalyticsState> | undefined;
        // Older consent covered fewer categories: ask again. A "no" stays a no.
        return state?.consent === "granted"
          ? ({ ...state, consent: "unknown" } as UsageAnalyticsState)
          : (state as UsageAnalyticsState);
      },
      storage: createJSONStorage(() =>
        resolveStorage(typeof window !== "undefined" ? window.localStorage : undefined),
      ),
    },
  ),
);
