import { APP_VERSION } from "../../branding";
import { COMMUNITY_URL } from "../../components/feedback/feedbackRelay";
import { useUsageAnalyticsStore } from "../usageAnalytics/usageAnalyticsStore";

/** True when `current` is the same version as `target` or a newer one (plain `1.2.3` numbers). */
export function versionAtLeast(current: string, target: string): boolean {
  const a = current.split(/[.+-]/).map((part) => Number.parseInt(part, 10) || 0);
  const b = target.split(/[.+-]/).map((part) => Number.parseInt(part, 10) || 0);
  for (let index = 0; index < 3; index += 1) {
    if ((a[index] ?? 0) !== (b[index] ?? 0)) return (a[index] ?? 0) > (b[index] ?? 0);
  }
  return true;
}

/**
 * Asks the Worker about the report ids this install made, and nothing else. Returns the versions
 * of reports that are fixed in the installed version and not yet told to the user, and marks
 * them as told. An install with no sent reports makes no request.
 */
export async function checkFixedForYou(currentVersion = APP_VERSION): Promise<string[]> {
  const { stuckReports, fixedSeen, markFixedSeen } = useUsageAnalyticsStore.getState();
  const pending = stuckReports.map((report) => report.id).filter((id) => !fixedSeen.includes(id));
  if (!COMMUNITY_URL || pending.length === 0) return [];
  try {
    const response = await fetch(`${COMMUNITY_URL}/fixed?ids=${pending.join(",")}`);
    if (!response.ok) return [];
    const body = (await response.json()) as { fixed?: { id: string; version: string }[] };
    const ready = (body.fixed ?? []).filter(
      (item) => pending.includes(item.id) && versionAtLeast(currentVersion, item.version),
    );
    markFixedSeen(ready.map((item) => item.id));
    return ready.map((item) => item.version);
  } catch {
    return [];
  }
}
