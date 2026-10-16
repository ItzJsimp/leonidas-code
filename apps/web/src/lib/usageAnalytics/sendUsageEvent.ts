import { APP_VERSION } from "../../branding";
import { useUsageAnalyticsStore } from "./usageAnalyticsStore";
import {
  buildPostHogPayload,
  isCompleteUsageEvent,
  osFromUserAgent,
  sanitizeUsageProperties,
  type UsageEventName,
} from "./usageEvents";

const CAPTURE_URL = "https://eu.i.posthog.com/capture/";

/** Set at build time with VITE_POSTHOG_KEY. Without it, nothing is sent. */
function readApiKey(): string {
  return (import.meta.env.VITE_POSTHOG_KEY as string | undefined)?.trim() ?? "";
}

/**
 * Send one usage event. Does nothing unless the user said Yes and a key exists.
 * Failures are ignored on purpose: analytics must never affect the app.
 */
export function sendUsageEvent(name: UsageEventName, properties?: Record<string, unknown>): void {
  const state = useUsageAnalyticsStore.getState();
  const apiKey = readApiKey();
  if (state.consent !== "granted" || apiKey.length === 0) return;
  const clean = sanitizeUsageProperties(name, properties);
  if (!isCompleteUsageEvent(name, clean)) return;
  const body = buildPostHogPayload({
    apiKey,
    installId: state.installId,
    friendLabel: state.friendLabel,
    event: name,
    properties: clean,
    appVersion: APP_VERSION,
    os: osFromUserAgent(globalThis.navigator?.userAgent ?? ""),
    timestamp: new Date(),
  });
  try {
    void fetch(CAPTURE_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      keepalive: true,
      credentials: "omit",
    }).catch(() => undefined);
  } catch {
    // Ignore: see above.
  }
}
