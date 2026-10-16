/**
 * Usage events: the only data Leonidas Code can send about how the app is used.
 * Every event has a fixed name and a fixed list of numeric or enum fields, so a
 * prompt, a path or a file name can never enter a payload.
 */
export const USAGE_EVENT_NAMES = [
  "install_first_run",
  "app_opened",
  "session_duration",
  "setup_completed",
  "feature_used",
] as const;
export type UsageEventName = (typeof USAGE_EVENT_NAMES)[number];

export const USAGE_FEATURE_IDS = [
  "chat",
  "tasks",
  "command_center",
  "pull_requests",
  "usage",
  "settings_general",
  "settings_providers",
  "settings_appearance",
  "settings_connections",
  "settings_integrations",
  "settings_keybindings",
  "settings_projects",
  "settings_scheduled_tasks",
] as const;
export type UsageFeatureId = (typeof USAGE_FEATURE_IDS)[number];

const NUMERIC_FIELDS: Readonly<Record<UsageEventName, readonly string[]>> = {
  install_first_run: [],
  app_opened: ["days_since_install", "launch_count"],
  session_duration: ["seconds"],
  setup_completed: ["seconds_to_setup"],
  feature_used: [],
};

export type UsageEventProperties = Readonly<Record<string, number | string>>;

/** Keep only the fields this event is allowed to carry, with safe values. */
export function sanitizeUsageProperties(
  name: UsageEventName,
  properties: Readonly<Record<string, unknown>> = {},
): UsageEventProperties {
  const clean: Record<string, number | string> = {};
  for (const key of NUMERIC_FIELDS[name]) {
    const value = properties[key];
    if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
      clean[key] = Math.round(value);
    }
  }
  if (name === "feature_used") {
    const feature = properties.feature;
    if ((USAGE_FEATURE_IDS as readonly unknown[]).includes(feature)) {
      clean.feature = feature as string;
    }
  }
  return clean;
}

/** True when the event has everything it needs to be worth sending. */
export function isCompleteUsageEvent(name: UsageEventName, props: UsageEventProperties): boolean {
  if (name === "feature_used") return typeof props.feature === "string";
  if (name === "session_duration") return typeof props.seconds === "number" && props.seconds >= 1;
  if (name === "setup_completed") return typeof props.seconds_to_setup === "number";
  return true;
}

/** Map a router pathname to a fixed feature id. Unknown routes return null. */
export function featureIdFromPathname(pathname: string): UsageFeatureId | null {
  const [first, second] = pathname.split("/").filter(Boolean);
  if (first === undefined) return "chat";
  if (first === "settings") {
    const id = `settings_${(second ?? "general").replaceAll("-", "_")}`;
    return (USAGE_FEATURE_IDS as readonly string[]).includes(id) ? (id as UsageFeatureId) : null;
  }
  const id = first.replaceAll("-", "_");
  if ((USAGE_FEATURE_IDS as readonly string[]).includes(id)) return id as UsageFeatureId;
  // Thread and draft routes are chats.
  return first === "draft" || second !== undefined ? "chat" : null;
}

export function osFromUserAgent(userAgent: string): "windows" | "macos" | "linux" | "other" {
  if (/Windows/i.test(userAgent)) return "windows";
  if (/Mac OS X|Macintosh/i.test(userAgent)) return "macos";
  if (/Linux|X11/i.test(userAgent)) return "linux";
  return "other";
}

export function daysSince(fromMs: number, nowMs: number): number {
  return Math.max(0, Math.floor((nowMs - fromMs) / 86_400_000));
}

export interface PostHogPayloadInput {
  readonly apiKey: string;
  readonly installId: string;
  readonly friendLabel: string;
  readonly event: UsageEventName;
  readonly properties: UsageEventProperties;
  readonly appVersion: string;
  readonly os: string;
  readonly timestamp: Date;
}

/** Body for POST https://eu.i.posthog.com/capture/. No IP, no URL, no user agent. */
export function buildPostHogPayload(input: PostHogPayloadInput) {
  const label = input.friendLabel.trim().slice(0, 40);
  return {
    api_key: input.apiKey,
    event: input.event,
    distinct_id: input.installId,
    timestamp: input.timestamp.toISOString(),
    properties: {
      ...input.properties,
      app_version: input.appVersion,
      os: input.os,
      $geoip_disable: true,
      $process_person_profile: false,
      ...(label.length > 0 ? { friend_label: label } : {}),
    },
  };
}
