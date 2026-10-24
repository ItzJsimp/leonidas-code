import {
  ArrowDownToLineIcon,
  ArrowLeftToLineIcon,
  ArrowRightToLineIcon,
  ArrowUpToLineIcon,
  CheckIcon,
  Columns2Icon,
  PlusIcon,
  XIcon,
} from "lucide-react";
import { memo, useMemo } from "react";

import {
  LAYOUT_PRESET_IDS,
  LAYOUT_PRESET_LABELS,
  MAX_PANES,
  countLeaves,
  findNeighbor,
  matchPreset,
  type MoveDirection,
} from "../../splitLayout";
import { useSplitLayoutStore } from "../../splitLayoutStore";
import { startNewThreadFromContext } from "../../lib/chatThreadActions";
import { useHandleNewThread } from "../../hooks/useHandleNewThread";
import { Button } from "../ui/button";
import {
  Menu,
  MenuItem,
  MenuPopup,
  MenuSeparator,
  MenuSub,
  MenuSubPopup,
  MenuSubTrigger,
  MenuTrigger,
} from "../ui/menu";
import { Tooltip, TooltipPopup, TooltipTrigger } from "../ui/tooltip";
import { LayoutGlyph } from "./LayoutGlyph";
import { useSplitPane } from "./splitPaneContext";
import { useSplitActions } from "./useSplitActions";

const MOVES: ReadonlyArray<{ direction: MoveDirection; label: string }> = [
  { direction: "left", label: "Move left" },
  { direction: "right", label: "Move right" },
  { direction: "up", label: "Move up" },
  { direction: "down", label: "Move down" },
];

/**
 * The "three dots" for a chat pane: split in any direction, move the pane,
 * pick a ready-made layout, or close it. Works from the ordinary single-chat
 * view too, where splitting is how a second pane first appears.
 */
export const SplitLayoutMenu = memo(function SplitLayoutMenu() {
  const { leafId } = useSplitPane();
  const root = useSplitLayoutStore((state) => state.root);
  const actions = useSplitActions();
  const newThread = useHandleNewThread();
  const paneCount = Math.max(1, countLeaves(root));
  const canAddPane = paneCount < MAX_PANES && actions.routeTarget !== null;
  const activePreset = useMemo(() => matchPreset(root), [root]);
  const isSplit = root !== null && leafId !== null;

  const replaceWithNewChat = () => {
    if (leafId) actions.focusPane(leafId);
    void startNewThreadFromContext({
      activeDraftThread: newThread.activeDraftThread,
      activeThread: newThread.activeThread ?? undefined,
      defaultProjectRef: newThread.defaultProjectRef,
      handleNewThread: newThread.handleNewThread,
    });
  };

  return (
    <Menu>
      <Tooltip>
        <TooltipTrigger
          render={
            <MenuTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-sm"
                  type="button"
                  aria-label="Choose pane layout"
                  className="shrink-0 [-webkit-app-region:no-drag]"
                />
              }
            />
          }
        >
          <Columns2Icon className="size-4" />
        </TooltipTrigger>
        <TooltipPopup side="bottom">Chat panes: split and layout</TooltipPopup>
      </Tooltip>
      <MenuPopup align="end" sideOffset={6}>
        <MenuItem
          disabled={!canAddPane}
          onClick={() => actions.splitPane("right", leafId ? { leafId } : undefined)}
        >
          <ArrowRightToLineIcon /> Split right
        </MenuItem>
        <MenuItem
          disabled={!canAddPane}
          onClick={() => actions.splitPane("bottom", leafId ? { leafId } : undefined)}
        >
          <ArrowDownToLineIcon /> Split down
        </MenuItem>
        <MenuItem
          disabled={!canAddPane}
          onClick={() => actions.splitPane("left", leafId ? { leafId } : undefined)}
        >
          <ArrowLeftToLineIcon /> Split left
        </MenuItem>
        <MenuItem
          disabled={!canAddPane}
          onClick={() => actions.splitPane("top", leafId ? { leafId } : undefined)}
        >
          <ArrowUpToLineIcon /> Split up
        </MenuItem>
        {isSplit ? (
          <>
            <MenuSeparator />
            {MOVES.map(({ direction, label }) => (
              <MenuItem
                key={direction}
                disabled={!findNeighbor(root, leafId, direction)}
                onClick={() => actions.movePane(leafId, direction)}
              >
                {label}
              </MenuItem>
            ))}
          </>
        ) : null}
        <MenuSeparator />
        <MenuSub>
          <MenuSubTrigger>Layouts</MenuSubTrigger>
          <MenuSubPopup>
            {LAYOUT_PRESET_IDS.map((preset) => (
              <MenuItem key={preset} onClick={() => actions.applyPreset(preset)}>
                <LayoutGlyph preset={preset} />
                <span className="min-w-0 flex-1">{LAYOUT_PRESET_LABELS[preset]}</span>
                {activePreset === preset ? <CheckIcon className="size-3.5" /> : null}
              </MenuItem>
            ))}
          </MenuSubPopup>
        </MenuSub>
        <MenuItem onClick={replaceWithNewChat}>
          <PlusIcon /> Replace with new chat
        </MenuItem>
        {isSplit ? (
          <>
            <MenuSeparator />
            <MenuItem onClick={() => actions.closePane(leafId)}>
              <XIcon /> Close pane
            </MenuItem>
            <MenuItem onClick={actions.collapse}>Close split view</MenuItem>
          </>
        ) : null}
      </MenuPopup>
    </Menu>
  );
});
