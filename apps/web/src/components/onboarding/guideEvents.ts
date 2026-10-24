/** Opens the learning guide dialog from anywhere, for example the command palette. */
export const OPEN_GUIDE_EVENT = "leonidas:open-guide";

export function openGuide(): void {
  window.dispatchEvent(new Event(OPEN_GUIDE_EVENT));
}
