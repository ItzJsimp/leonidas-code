import { useLocation } from "@tanstack/react-router";
import { useEffect } from "react";

import { checkFixedForYou } from "~/lib/community/fixedForYou";
import { pushScore } from "~/lib/community/leaderboard";
import { recordStuckAction, screenFromPath } from "~/lib/community/stuckReport";
import { useUsageAnalyticsStore } from "~/lib/usageAnalytics/usageAnalyticsStore";
import { toastManager } from "../ui/toast";
import { useWeeklyStats } from "./useWeeklyStats";

const PUSH_EVERY_MS = 30 * 60 * 1000;

/** Mounted once at the app root: the fixed-for-you notice at launch and the hourly score push. */
export function CommunityCoordinator() {
  const consent = useUsageAnalyticsStore((state) => state.leaderboardConsent);
  const boards = useUsageAnalyticsStore((state) => state.boards);
  // The Scribe history read runs only for someone who joined a board, so it adds nothing at startup.
  const stats = useWeeklyStats(consent === "granted" && boards.length > 0);
  const pathname = useLocation({ select: (location) => location.pathname });

  useEffect(() => {
    recordStuckAction(`opened-${screenFromPath(pathname).replace("/", "-")}`);
  }, [pathname]);

  useEffect(() => {
    void checkFixedForYou().then((versions) => {
      if (versions.length === 0) return;
      toastManager.add({
        type: "success",
        title: "Fixed for you",
        description:
          versions.length === 1
            ? "A problem you reported is fixed in this version."
            : `${versions.length} problems you reported are fixed in this version.`,
      });
    });
  }, []);

  useEffect(() => {
    if (consent !== "granted" || boards.length === 0) return;
    const push = () => boards.forEach((code) => void pushScore(code, stats, Date.now()));
    push();
    const timer = setInterval(push, PUSH_EVERY_MS);
    return () => clearInterval(timer);
  }, [consent, boards, stats]);

  return null;
}
