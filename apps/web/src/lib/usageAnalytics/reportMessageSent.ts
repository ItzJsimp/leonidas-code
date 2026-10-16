import { sendUsageEvent } from "./sendUsageEvent";
import { useUsageAnalyticsStore } from "./usageAnalyticsStore";

/** Call after the user sends a message. Reports time to first message once, after setup. */
export function reportMessageSent(): void {
  sendUsageEvent("messages_sent", { count: 1 });
  const state = useUsageAnalyticsStore.getState();
  if (state.firstMessageSent || state.setupDoneAt === null) return;
  state.markFirstMessageSent();
  sendUsageEvent("time_to_first_message", { seconds: (Date.now() - state.setupDoneAt) / 1000 });
}
