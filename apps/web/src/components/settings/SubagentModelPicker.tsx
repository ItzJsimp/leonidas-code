import type { ServerProvider } from "@t3tools/contracts";
import { ChevronDownIcon } from "lucide-react";

import { Button } from "../ui/button";
import {
  Menu,
  MenuCheckboxItem,
  MenuGroup,
  MenuGroupLabel,
  MenuPopup,
  MenuSeparator,
  MenuTrigger,
} from "../ui/menu";
import {
  buildModelPickerGroups,
  modelPickerSummary,
  toggleModelId,
} from "./subagentModelPicker.logic";

/** A drop-down of every model the connected accounts offer, with a box for each. */
export function SubagentModelPicker(props: {
  readonly providers: ReadonlyArray<ServerProvider>;
  readonly selected: ReadonlyArray<string>;
  readonly onChange: (next: string[]) => void;
  readonly "aria-label": string;
}) {
  const groups = buildModelPickerGroups(props.providers, props.selected);
  return (
    <Menu>
      <MenuTrigger
        render={
          <Button
            variant="outline"
            size="sm"
            className="w-72 justify-between"
            aria-label={props["aria-label"]}
          />
        }
      >
        <span className="truncate">{modelPickerSummary(props.selected)}</span>
        <ChevronDownIcon aria-hidden className="size-4 shrink-0 opacity-70" />
      </MenuTrigger>
      <MenuPopup align="end" className="max-h-80 w-80 overflow-y-auto">
        {groups.length === 0 ? (
          <div className="px-2 py-2 text-muted-foreground text-sm">
            No account lists models yet. Connect an account first.
          </div>
        ) : null}
        {groups.map((group, index) => (
          <MenuGroup key={group.key}>
            {index > 0 ? <MenuSeparator /> : null}
            <MenuGroupLabel>{group.label}</MenuGroupLabel>
            {group.models.map((model) => (
              <MenuCheckboxItem
                key={model.slug}
                checked={props.selected.includes(model.slug)}
                onCheckedChange={(checked) =>
                  props.onChange(toggleModelId(props.selected, model.slug, checked))
                }
              >
                <span className="truncate">{model.name}</span>
              </MenuCheckboxItem>
            ))}
          </MenuGroup>
        ))}
      </MenuPopup>
    </Menu>
  );
}
