import { sendUsageEvent } from "~/lib/usageAnalytics/sendUsageEvent";
import { randomUUID } from "~/lib/utils";
import type { FeedbackReport } from "./feedback.logic";

/**
 * Feedback relay endpoint. Unset in installed builds until the real relay exists; in dev it
 * defaults to the mock (`vp run` -> `node scripts/mock-feedback-relay.ts`).
 */
const RELAY_URL: string =
  import.meta.env.VITE_LEONIDAS_FEEDBACK_URL ??
  (import.meta.env.DEV ? "http://127.0.0.1:8787/feedback" : "");

/** False in installed builds until the real relay is wired; entry points hide themselves. */
export const FEEDBACK_ENABLED = RELAY_URL !== "";

/** Base of the community routes (stuck reports, leaderboard) on the same Worker. */
export const COMMUNITY_URL = RELAY_URL.replace(/\/feedback$/, "");

const INSTALL_ID_KEY = "leonidas.feedback.installId";
const NAME_KEY = "leonidas.feedback.name";

/** Random per-install id: lets the relay rate-limit and group reports without any sign-in. */
export function getInstallId(): string {
  try {
    const existing = localStorage.getItem(INSTALL_ID_KEY);
    if (existing) return existing;
    const created = randomUUID();
    localStorage.setItem(INSTALL_ID_KEY, created);
    return created;
  } catch {
    return randomUUID();
  }
}

export function getSavedName(): string {
  try {
    return localStorage.getItem(NAME_KEY) ?? "";
  } catch {
    return "";
  }
}

export function saveName(name: string): void {
  try {
    localStorage.setItem(NAME_KEY, name.trim());
  } catch {
    // Name is a convenience only.
  }
}

export type SubmitResult = { readonly ok: true } | { readonly ok: false; readonly error: string };

export async function submitFeedback(report: FeedbackReport): Promise<SubmitResult> {
  if (!RELAY_URL) {
    return { ok: false, error: "Feedback isn't connected in this build yet." };
  }
  try {
    const response = await fetch(RELAY_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(report),
    });
    if (response.status === 429) {
      return { ok: false, error: "Too many reports just now. Try again in a minute." };
    }
    if (!response.ok) return { ok: false, error: `Couldn't send (${response.status}).` };
    sendUsageEvent("feedback_sent");
    return { ok: true };
  } catch {
    return { ok: false, error: "Couldn't reach the feedback service. Check your connection." };
  }
}
