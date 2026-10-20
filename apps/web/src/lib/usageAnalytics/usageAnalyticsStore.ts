// @effect-diagnostics cryptoRandomUUID:off - synchronous node and global APIs are used on purpose in this file.
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { PRIVACY_POLICY_URL } from "../../legalLinks";
import { resolveStorage } from "../storage";

/**
 * Bump when an event adds a data category the dialog did not list. The persist
 * migration below then turns older "granted" answers back into "unknown", so the
 * user is asked again. Version 2: setup steps, AIOS counts, providers, errors.
 * Version 3: "I'm stuck" reports, the fixed-for-you lookup and the friends leaderboard.
 */
export const USAGE_CONSENT_VERSION = 3;

export const USAGE_PRIVACY_URL = PRIVACY_POLICY_URL;

export type UsageConsent = "unknown" | "granted" | "declined";

interface UsageAnalyticsState {
  /** Random id made on this machine. Not linked to a name, email or account. */
  installId: string;
  installedAt: number;
  consent: UsageConsent;
  /** Optional name a tester types so the owner can tell friends apart. */
  friendLabel: string;
  /** Own consent for the friends leaderboard. A new version turns "granted" back into "unknown". */
  leaderboardConsent: UsageConsent;
  /** Random id for the leaderboard only. Never the analytics install id. */
  boardId: string;
  boardNickname: string;
  /** False keeps the member anonymous: friends see "Friend N" instead of the nickname. */
  boardPublic: boolean;
  /** Invite codes this install joined. */
  boards: string[];
  /** Ids of "I'm stuck" reports this install sent. The id is random and unrelated to installId. */
  stuckReports: { id: string; at: number }[];
  /** Fixed reports the user was already told about. */
  fixedSeen: string[];
  /** Messages sent in the week that starts on `week` (Monday, UTC). A local count for the leaderboard. */
  messagesThisWeek: { week: string; count: number };
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
  setLeaderboardConsent: (consent: UsageConsent) => void;
  setBoardProfile: (nickname: string, isPublic: boolean) => void;
  addBoard: (code: string) => void;
  removeBoard: (code: string) => void;
  addStuckReport: (id: string) => void;
  markFixedSeen: (ids: string[]) => void;
  countMessage: (week: string) => void;
  markFirstRunSent: () => void;
  markSetupSent: (doneAt: number) => void;
  markFirstMessageSent: () => void;
  setLastAppVersion: (version: string) => void;
  setSessionOpen: (open: boolean) => void;
  countLaunch: () => number;
}

/** 32 hex characters, the shape the community Worker accepts for a random id. */
export function makeHexId(): string {
  return makeInstallId().replaceAll("-", "").padEnd(32, "0").slice(0, 32);
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
      leaderboardConsent: "unknown",
      boardId: makeHexId(),
      boardNickname: "",
      boardPublic: false,
      boards: [],
      stuckReports: [],
      fixedSeen: [],
      messagesThisWeek: { week: "", count: 0 },
      firstRunSent: false,
      setupSent: false,
      setupDoneAt: null,
      firstMessageSent: false,
      lastAppVersion: "",
      sessionOpen: false,
      launchCount: 0,
      setConsent: (consent) => set({ consent }),
      setFriendLabel: (friendLabel) => set({ friendLabel: friendLabel.slice(0, 40) }),
      setLeaderboardConsent: (leaderboardConsent) => set({ leaderboardConsent }),
      setBoardProfile: (nickname, isPublic) =>
        set({ boardNickname: nickname.trim().slice(0, 20), boardPublic: isPublic }),
      addBoard: (code) => set({ boards: [...new Set([...get().boards, code])] }),
      removeBoard: (code) => set({ boards: get().boards.filter((item) => item !== code) }),
      addStuckReport: (id) =>
        set({ stuckReports: [...get().stuckReports, { id, at: Date.now() }].slice(-20) }),
      markFixedSeen: (ids) => set({ fixedSeen: [...new Set([...get().fixedSeen, ...ids])] }),
      countMessage: (week) => {
        const { messagesThisWeek } = get();
        const count = messagesThisWeek.week === week ? messagesThisWeek.count + 1 : 1;
        set({ messagesThisWeek: { week, count } });
      },
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
        return {
          ...state,
          ...(state?.consent === "granted" ? { consent: "unknown" } : {}),
          ...(state?.leaderboardConsent === "granted" ? { leaderboardConsent: "unknown" } : {}),
        } as UsageAnalyticsState;
      },
      storage: createJSONStorage(() =>
        resolveStorage(typeof window !== "undefined" ? window.localStorage : undefined),
      ),
    },
  ),
);
