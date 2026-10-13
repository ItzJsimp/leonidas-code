/** Menu action the renderer turns into the quick-capture box. */
export const CAPTURE_MENU_ACTION = "open-capture";

/** Works while any other app has focus. Electron maps CommandOrControl to Cmd on macOS. */
export const CAPTURE_ACCELERATOR = "CommandOrControl+Shift+Space";

interface ShortcutRegistry {
  readonly register: (accelerator: string, callback: () => void) => boolean;
  readonly unregister: (accelerator: string) => void;
}

/**
 * Registers the OS-wide capture hotkey and returns how to release it. A refused registration
 * (another app owns the chord) returns `null` so the in-app button and keybinding still work.
 */
export function registerCaptureHotkey(
  shortcuts: ShortcutRegistry,
  onPress: () => void,
  accelerator: string = CAPTURE_ACCELERATOR,
): (() => void) | null {
  let registered = false;
  try {
    registered = shortcuts.register(accelerator, onPress);
  } catch {
    registered = false;
  }
  return registered ? () => shortcuts.unregister(accelerator) : null;
}
