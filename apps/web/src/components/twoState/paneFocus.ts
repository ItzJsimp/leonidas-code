import type { PaneName } from "./swapKeys";

const FOCUSABLE =
  'textarea, [contenteditable="true"], input, select, button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])';

/** In the chat pane the message box comes first, ahead of the chat list buttons. */
const PREFERRED: Partial<Record<PaneName, string>> = {
  chat: 'textarea, [contenteditable="true"]',
};

/** The pane that holds keyboard focus, or null when focus is in neither. */
export function focusedPane(): PaneName | null {
  const pane = document.activeElement?.closest("[data-pane]")?.getAttribute("data-pane");
  return pane === "left" || pane === "chat" ? pane : null;
}

/** Moves focus into a pane: its first field or control, else the pane itself. */
export function focusPane(pane: PaneName): void {
  const root = document.querySelector<HTMLElement>(`[data-pane="${pane}"]`);
  if (!root) return;
  const preferred = PREFERRED[pane];
  const target =
    (preferred ? root.querySelector<HTMLElement>(preferred) : null) ??
    root.querySelector<HTMLElement>(FOCUSABLE);
  if (target) {
    target.focus();
    return;
  }
  root.tabIndex = -1;
  root.focus();
}
