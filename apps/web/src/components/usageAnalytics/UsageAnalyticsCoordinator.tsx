import { useLocation } from "@tanstack/react-router";
import { useEffect, useRef } from "react";

import { useClientSettings, useClientSettingsHydrationStatus } from "../../hooks/useSettings";
import { sendUsageEvent } from "../../lib/usageAnalytics/sendUsageEvent";
import { useUsageAnalyticsStore } from "../../lib/usageAnalytics/usageAnalyticsStore";
import { daysSince, featureIdFromPathname } from "../../lib/usageAnalytics/usageEvents";
import { UsageAnalyticsConsentDialog } from "./UsageAnalyticsConsentDialog";

/** Sends the five core usage events once the user has said Yes. */
export function UsageAnalyticsCoordinator() {
  const consent = useUsageAnalyticsStore((state) => state.consent);
  const pathname = useLocation({ select: (location) => location.pathname });
  const hydrated = useClientSettingsHydrationStatus() === "ready";
  const onboardingCompletedAt = useClientSettings((settings) => settings.onboardingCompletedAt);
  const lastFeature = useRef<string | null>(null);

  // install_first_run and app_opened: once per consented launch.
  useEffect(() => {
    if (consent !== "granted") return;
    const state = useUsageAnalyticsStore.getState();
    if (!state.firstRunSent) {
      sendUsageEvent("install_first_run");
      state.markFirstRunSent();
    }
    sendUsageEvent("app_opened", {
      days_since_install: daysSince(state.installedAt, Date.now()),
      launch_count: state.countLaunch(),
    });
  }, [consent]);

  // session_duration: visible seconds, sent each time the window is hidden or closed.
  useEffect(() => {
    if (consent !== "granted") return;
    let visibleSince: number | null = document.visibilityState === "visible" ? Date.now() : null;
    const flush = () => {
      if (visibleSince === null) return;
      sendUsageEvent("session_duration", { seconds: (Date.now() - visibleSince) / 1000 });
      visibleSince = null;
    };
    const onVisibility = () => {
      if (document.visibilityState === "hidden") flush();
      else visibleSince ??= Date.now();
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", flush);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", flush);
      flush();
    };
  }, [consent]);

  // setup_completed: time from first launch to the end of the welcome wizard.
  useEffect(() => {
    if (consent !== "granted" || !hydrated || onboardingCompletedAt === null) return;
    const state = useUsageAnalyticsStore.getState();
    if (state.setupSent) return;
    const finishedAt = Date.parse(String(onboardingCompletedAt));
    if (Number.isFinite(finishedAt)) {
      state.markSetupSent(finishedAt);
      sendUsageEvent("setup_completed", {
        seconds_to_setup: (finishedAt - state.installedAt) / 1000,
      });
    } else state.markSetupSent(Date.now());
  }, [consent, hydrated, onboardingCompletedAt]);

  // feature_used: one event when the user moves to a different area of the app.
  useEffect(() => {
    if (consent !== "granted") return;
    const feature = featureIdFromPathname(pathname);
    if (feature === null || feature === lastFeature.current) return;
    lastFeature.current = feature;
    sendUsageEvent("feature_used", { feature });
  }, [consent, pathname]);

  return <UsageAnalyticsConsentDialog />;
}
