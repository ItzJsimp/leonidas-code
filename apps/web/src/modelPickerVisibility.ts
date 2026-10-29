// Keydown handlers read this on every key, so a mount count replaces a document query.
let mountedModelPickers = 0;

export function registerModelPickerContent(): () => void {
  mountedModelPickers += 1;
  return () => {
    mountedModelPickers -= 1;
  };
}

/**
 * Model-picker visibility is already represented by the mounted popover.
 * Shortcut arbitration reads that source directly instead of mirroring it in
 * a second React or external store.
 */
export function isModelPickerOpen(): boolean {
  return mountedModelPickers > 0;
}
