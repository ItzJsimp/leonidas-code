import type { ModelSelection } from "@t3tools/contracts";
import type { AutoRouteCandidate } from "@t3tools/shared/autoRouter";
import { useMemo } from "react";
import { Menu, MenuItem, MenuPopup, MenuTrigger } from "../ui/menu";
import { ComposerControl } from "./ComposerControl";
import { useComposerMenuProps } from "./composerEventScope";
import { resolveThreadPresets } from "./threadPresets";

export function ThreadPresetPicker(props: {
  candidates: ReadonlyArray<AutoRouteCandidate>;
  disabled: boolean;
  onSelect: (selection: ModelSelection) => void;
}) {
  const presets = useMemo(() => resolveThreadPresets(props.candidates), [props.candidates]);
  const floatingProps = useComposerMenuProps();
  return (
    <Menu>
      <MenuTrigger
        render={<ComposerControl size="sm" disabled={props.disabled} aria-label="Thread preset" />}
      >
        Preset
      </MenuTrigger>
      <MenuPopup align="start" {...floatingProps}>
        {presets.map((preset) => (
          <MenuItem
            key={preset.label}
            disabled={!preset.selection}
            onClick={() => {
              if (preset.selection) props.onSelect(preset.selection);
            }}
          >
            <span>{preset.label}</span>
            <span className="text-muted-foreground text-xs">
              {preset.model} · {preset.effort}
              {preset.selection ? "" : " · unavailable"}
            </span>
          </MenuItem>
        ))}
      </MenuPopup>
    </Menu>
  );
}
