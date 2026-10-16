import { ensureLocalApi } from "../../localApi";
import {
  USAGE_PRIVACY_URL,
  useUsageAnalyticsStore,
} from "../../lib/usageAnalytics/usageAnalyticsStore";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Switch } from "../ui/switch";
import { SettingsRow } from "./settingsLayout";

export function UsageAnalyticsSettings() {
  const consent = useUsageAnalyticsStore((state) => state.consent);
  const friendLabel = useUsageAnalyticsStore((state) => state.friendLabel);
  const installId = useUsageAnalyticsStore((state) => state.installId);
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
      <SettingsRow
        title="Your install ID and privacy notice"
        description={`Random ID: ${installId}. To delete your numbers, send this ID with Send feedback.`}
        control={
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => void navigator.clipboard?.writeText(installId)}
            >
              Copy ID
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => void ensureLocalApi().shell.openExternal(USAGE_PRIVACY_URL)}
            >
              Privacy notice
            </Button>
          </div>
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
