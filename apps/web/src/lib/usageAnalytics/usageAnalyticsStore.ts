import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { resolveStorage } from "../storage";

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
  launchCount: number;
  setConsent: (consent: UsageConsent) => void;
  setFriendLabel: (label: string) => void;
  markFirstRunSent: () => void;
  markSetupSent: (doneAt: number) => void;
  markFirstMessageSent: () => void;
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
      launchCount: 0,
      setConsent: (consent) => set({ consent }),
      setFriendLabel: (friendLabel) => set({ friendLabel: friendLabel.slice(0, 40) }),
      markFirstRunSent: () => set({ firstRunSent: true }),
      markSetupSent: (setupDoneAt) => set({ setupSent: true, setupDoneAt }),
      markFirstMessageSent: () => set({ firstMessageSent: true }),
      countLaunch: () => {
        const launchCount = get().launchCount + 1;
        set({ launchCount });
        return launchCount;
      },
    }),
    {
      name: "leonidas:usage-analytics:v1",
      version: 1,
      storage: createJSONStorage(() =>
        resolveStorage(typeof window !== "undefined" ? window.localStorage : undefined),
      ),
    },
  ),
);
