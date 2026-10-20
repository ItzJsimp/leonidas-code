import { weekStart } from "../community/leaderboard";
import { recordStuckAction } from "../community/stuckReport";
import { sendUsageEvent } from "./sendUsageEvent";
import { useUsageAnalyticsStore } from "./usageAnalyticsStore";

/** Call after the user sends a message. Reports time to first message once, after setup. */
export function reportMessageSent(): void {
  sendUsageEvent("messages_sent", { count: 1 });
  const state = useUsageAnalyticsStore.getState();
  // Local only: these feed the leaderboard count and the stuck report's last action.
  state.countMessage(weekStart(Date.now()));
  recordStuckAction("message-sent");
  if (state.firstMessageSent || state.setupDoneAt === null) return;
  state.markFirstMessageSent();
  sendUsageEvent("time_to_first_message", { seconds: (Date.now() - state.setupDoneAt) / 1000 });
}
