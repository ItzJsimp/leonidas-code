import { Select, SelectItem, SelectPopup, SelectTrigger, SelectValue } from "../ui/select";
import { SettingsRow } from "./settingsLayout";
import { searchableSetting } from "./settingsSearch";
import { useScopedSettings, useUpdateScopedSettings } from "./useScopedSettings";

const EFFORT_OPTIONS = [
  { value: "default", label: "Model default" },
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
] as const;

export function ReasoningEffortSettings() {
  const effort = useScopedSettings((settings) => settings.defaultReasoningEffort);
  const updateSettings = useUpdateScopedSettings();
  const value = effort ?? "default";

  return (
    <SettingsRow
      {...searchableSetting("default-reasoning-effort")}
      description="How hard the AI thinks before it answers in new chats. A model that does not have the level you choose uses its own default. A level you pick in the message box wins."
      control={
        <Select
          value={value}
          onValueChange={(next) => {
            if (next === "default") updateSettings({ defaultReasoningEffort: null });
            else if (next === "low" || next === "medium" || next === "high") {
              updateSettings({ defaultReasoningEffort: next });
            }
          }}
        >
          <SelectTrigger size="sm" className="w-full sm:w-40" aria-label="Default reasoning effort">
            <SelectValue>
              {EFFORT_OPTIONS.find((option) => option.value === value)?.label}
            </SelectValue>
          </SelectTrigger>
          <SelectPopup align="end" alignItemWithTrigger={false}>
            {EFFORT_OPTIONS.map((option) => (
              <SelectItem key={option.value} hideIndicator value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectPopup>
        </Select>
      }
    />
  );
}
