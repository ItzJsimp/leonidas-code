import type { CacheWarningCategory } from "@t3tools/client-runtime/cache-awareness";
import { useClientSettings, useUpdateClientSettings } from "../../hooks/useSettings";
import { Switch } from "../ui/switch";
import { SettingsRow } from "./settingsLayout";
import { CacheNoticeControls } from "../chat/CacheAwareness";

const categories: readonly [CacheWarningCategory, string][] = [
  ["model", "Model cache warnings"],
  ["account", "Connection cache warnings"],
  ["configuration", "Effort and options cache notices"],
  ["context", "History cache warnings"],
  ["expiry", "Cache expiry notices"],
  ["reuse-drop", "Cache reuse drop notices"],
];
export function CacheSettings() {
  const muted = useClientSettings((s) => s.cacheMutedWarnings);
  const update = useUpdateClientSettings();
  return (
    <div className="grid gap-2">
      {categories.map(([category, title]) => (
        <SettingsRow
          key={category}
          title={title}
          description="Applies across chats on this device. Cache status stays visible."
          control={
            <Switch
              aria-label={title}
              checked={!muted.includes(category)}
              onCheckedChange={(checked) => {
                void update({
                  cacheMutedWarnings: checked
                    ? muted.filter((x) => x !== category)
                    : [...muted, category],
                });
              }}
            />
          }
        />
      ))}
      <SettingsRow
        title="Pause cache expiry notices"
        description="Other cache warnings stay active."
        control={<CacheNoticeControls />}
      />
    </div>
  );
}
