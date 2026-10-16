import { describe, expect, it, vi } from "vite-plus/test";

import {
  buildPostHogPayload,
  featureIdFromPathname,
  isCompleteUsageEvent,
  osFromUserAgent,
  sanitizeUsageProperties,
} from "./usageEvents";

describe("sanitizeUsageProperties", () => {
  it("keeps only the numeric fields an event may carry", () => {
    expect(
      sanitizeUsageProperties("app_opened", {
        days_since_install: 3.4,
        launch_count: 7,
        prompt: "secret text",
        path: "C:/Users/me/code",
      }),
    ).toEqual({ days_since_install: 3, launch_count: 7 });
  });

  it("drops strings, negatives and infinities from numeric fields", () => {
    expect(sanitizeUsageProperties("session_duration", { seconds: "12" })).toEqual({});
    expect(sanitizeUsageProperties("session_duration", { seconds: -1 })).toEqual({});
    expect(sanitizeUsageProperties("session_duration", { seconds: Infinity })).toEqual({});
  });

  it("accepts only known feature ids", () => {
    expect(sanitizeUsageProperties("feature_used", { feature: "tasks" })).toEqual({
      feature: "tasks",
    });
    expect(sanitizeUsageProperties("feature_used", { feature: "C:/my/file.ts" })).toEqual({});
  });
});

describe("setup funnel events", () => {
  it("accepts only known step ids", () => {
    expect(sanitizeUsageProperties("setup_step_completed", { step: "skills" })).toEqual({
      step: "skills",
    });
    expect(sanitizeUsageProperties("setup_abandoned_at_step", { step: "C:/Users/x" })).toEqual({});
    expect(isCompleteUsageEvent("setup_abandoned_at_step", {})).toBe(false);
  });
});

describe("providers and clicks", () => {
  it("keeps only known provider kinds", () => {
    expect(
      sanitizeUsageProperties("providers_connected", {
        providers: ["codex", "claudeAgent", "codex", "C:/Users/x", "sk-123"],
      }),
    ).toEqual({ providers: "claudeAgent,codex", provider_count: 2 });
  });

  it("drops clicks on elements outside the allowlist", () => {
    expect(sanitizeUsageProperties("ui_element_clicked", { element: "new_thread" })).toEqual({
      element: "new_thread",
    });
    expect(sanitizeUsageProperties("ui_element_clicked", { element: "my prompt" })).toEqual({});
  });
});

describe("health events", () => {
  it("accepts only known error kinds and never free text", () => {
    expect(sanitizeUsageProperties("error_shown", { kind: "chunk_load" })).toEqual({
      kind: "chunk_load",
    });
    expect(sanitizeUsageProperties("error_shown", { kind: "Error at C:/Users/x" })).toEqual({});
    expect(sanitizeUsageProperties("crash", { message: "my prompt", path: "sk-123" })).toEqual({});
  });
});

describe("isCompleteUsageEvent", () => {
  it("skips empty sessions and feature events with no feature", () => {
    expect(isCompleteUsageEvent("session_duration", { seconds: 0 })).toBe(false);
    expect(isCompleteUsageEvent("session_duration", { seconds: 5 })).toBe(true);
    expect(isCompleteUsageEvent("feature_used", {})).toBe(false);
  });
});

describe("featureIdFromPathname", () => {
  it("maps routes to fixed ids and never echoes ids or paths", () => {
    expect(featureIdFromPathname("/")).toBe("chat");
    expect(featureIdFromPathname("/tasks")).toBe("tasks");
    expect(featureIdFromPathname("/command-center")).toBe("command_center");
    expect(featureIdFromPathname("/settings/providers")).toBe("settings_providers");
    expect(featureIdFromPathname("/settings/scheduled-tasks")).toBe("settings_scheduled_tasks");
    expect(featureIdFromPathname("/env-1/thread-abc")).toBe("chat");
    expect(featureIdFromPathname("/draft/abc")).toBe("chat");
    expect(featureIdFromPathname("/pair")).toBeNull();
  });
});

describe("osFromUserAgent", () => {
  it("returns a coarse system type", () => {
    expect(osFromUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64)")).toBe("windows");
    expect(osFromUserAgent("Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0)")).toBe("macos");
    expect(osFromUserAgent("Mozilla/5.0 (X11; Linux x86_64)")).toBe("linux");
  });
});

describe("buildPostHogPayload", () => {
  const base = {
    apiKey: "phc_test",
    installId: "11111111-1111-1111-1111-111111111111",
    friendLabel: "",
    event: "app_opened" as const,
    properties: { launch_count: 2 },
    appVersion: "1.0.9",
    os: "windows",
    timestamp: new Date("2026-10-16T12:00:00.000Z"),
  };

  it("turns off geo lookup and person profiles", () => {
    const payload = buildPostHogPayload(base);
    expect(payload.distinct_id).toBe(base.installId);
    expect(payload.properties).toMatchObject({
      launch_count: 2,
      app_version: "1.0.9",
      os: "windows",
      $geoip_disable: true,
      $process_person_profile: false,
    });
    expect(payload.properties).not.toHaveProperty("friend_label");
  });

  it("adds a trimmed tester name only when set", () => {
    const payload = buildPostHogPayload({ ...base, friendLabel: "  Gavin  " });
    expect(payload.properties).toMatchObject({ friend_label: "Gavin" });
  });
});

describe("sendUsageEvent", () => {
  it("sends nothing before consent and nothing without a key", async () => {
    vi.resetModules();
    const fetchMock = vi.fn(() => Promise.resolve(new Response()));
    vi.stubGlobal("fetch", fetchMock);
    vi.stubEnv("VITE_POSTHOG_KEY", "phc_test");
    const { useUsageAnalyticsStore } = await import("./usageAnalyticsStore");
    const { sendUsageEvent } = await import("./sendUsageEvent");

    sendUsageEvent("install_first_run");
    expect(fetchMock).not.toHaveBeenCalled();

    useUsageAnalyticsStore.getState().setConsent("granted");
    sendUsageEvent("install_first_run");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const body = JSON.parse(
      (fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].body as string,
    );
    expect(body.event).toBe("install_first_run");

    useUsageAnalyticsStore.getState().setConsent("declined");
    sendUsageEvent("app_opened", { launch_count: 1 });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });
});
