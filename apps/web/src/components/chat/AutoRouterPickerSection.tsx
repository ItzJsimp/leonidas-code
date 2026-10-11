import type { AutoRoutePreference } from "@t3tools/contracts/settings";
import { AUTO_ROUTE_PREFERENCES } from "@t3tools/shared/autoRouter";
import { RouteIcon } from "lucide-react";

import { Toggle, ToggleGroup } from "../ui/toggle-group";

const SHORT_LABELS: Record<AutoRoutePreference, string> = {
  balanced: "Balanced",
  cost: "Cost",
  quality: "Quality",
  speed: "Speed",
};

/**
 * Top of the model picker. Choosing a goal lets the composer pick a model per
 * message from the connected providers; picking a model below turns it off.
 */
export function AutoRouterPickerSection(props: {
  preference: AutoRoutePreference | null;
  onPreferenceChange: (preference: AutoRoutePreference | null) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5 border-b px-3 py-2.5" data-auto-router-section="true">
      <div className="flex items-center gap-1.5 text-xs">
        <RouteIcon className="size-3.5 text-muted-foreground" aria-hidden="true" />
        <span className="font-medium">Leonidas Autorouter</span>
        <span className="truncate text-muted-foreground">
          {props.preference === null ? "Off" : "Picks a model for each message"}
        </span>
      </div>
      <ToggleGroup
        aria-label="Autorouter goal"
        className="w-full *:flex-1"
        value={[props.preference ?? "off"]}
        onValueChange={(next) => {
          const value = next[0];
          if (value === undefined) return;
          props.onPreferenceChange(
            AUTO_ROUTE_PREFERENCES.find((preference) => preference === value) ?? null,
          );
        }}
      >
        <Toggle value="off">Off</Toggle>
        {AUTO_ROUTE_PREFERENCES.map((preference) => (
          <Toggle key={preference} value={preference}>
            {SHORT_LABELS[preference]}
          </Toggle>
        ))}
      </ToggleGroup>
    </div>
  );
}
