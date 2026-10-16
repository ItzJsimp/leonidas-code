import { useUsageAnalyticsStore } from "../../lib/usageAnalytics/usageAnalyticsStore";
import { Input } from "../ui/input";
import { Switch } from "../ui/switch";
import { SettingsRow } from "./settingsLayout";

export function UsageAnalyticsSettings() {
  const consent = useUsageAnalyticsStore((state) => state.consent);
  const friendLabel = useUsageAnalyticsStore((state) => state.friendLabel);
  const setConsent = useUsageAnalyticsStore((state) => state.setConsent);
  const setFriendLabel = useUsageAnalyticsStore((state) => state.setFriendLabel);
  return (
    <div className="grid gap-2">
      <SettingsRow
        title="Share anonymous usage"
        description="Counts and timings only, tied to a random ID. Never your messages, code, file names or paths."
        control={
          <Switch
            aria-label="Share anonymous usage"
            checked={consent === "granted"}
            onCheckedChange={(checked) => setConsent(checked ? "granted" : "declined")}
          />
        }
      />
      {consent === "granted" ? (
        <SettingsRow
          title="Tester name (optional)"
          description="Only for testers helping us: adds this name to your usage so we can tell testers apart."
          control={
            <Input
              aria-label="Tester name"
              className="w-48"
              maxLength={40}
              value={friendLabel}
              onChange={(event) => setFriendLabel(event.target.value)}
            />
          }
        />
      ) : null}
    </div>
  );
}
