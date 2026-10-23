import { useLayoutEffect, useRef, useState, type RefObject } from "react";

import { observeResize } from "~/lib/observeResize";

interface LabelsState {
  readonly iconsOnly: boolean;
  /** The row width the labels needed when they last showed. */
  readonly needed: number;
}

/**
 * Labels show while the whole row fits. When they overflow, the row shows icons only, so no label
 * cuts mid-word at the scroll edge. Labels come back once the room holds the width they needed.
 */
export function nextIconsOnly(
  input: LabelsState & { readonly content: number; readonly room: number },
): LabelsState {
  if (!input.iconsOnly && input.content > input.room + 1) {
    return { iconsOnly: true, needed: input.content };
  }
  if (input.iconsOnly && input.room >= input.needed) {
    return { iconsOnly: false, needed: input.needed };
  }
  return { iconsOnly: input.iconsOnly, needed: input.needed };
}

/** Watches a scroll row (`room`) and its content box, and says when to show icons only. */
export function useIconsOnly(
  room: RefObject<HTMLElement | null>,
  content: RefObject<HTMLElement | null>,
): boolean {
  const [iconsOnly, setIconsOnly] = useState(false);
  const state = useRef<LabelsState>({ iconsOnly: false, needed: 0 });
  useLayoutEffect(() => {
    const roomElement = room.current;
    const contentElement = content.current;
    if (!roomElement || !contentElement) return;
    const check = () => {
      const next = nextIconsOnly({
        ...state.current,
        content: contentElement.scrollWidth,
        room: roomElement.clientWidth,
      });
      state.current = next;
      setIconsOnly(next.iconsOnly);
    };
    return observeResize([roomElement, contentElement], check);
  }, [room, content]);
  return iconsOnly;
}
