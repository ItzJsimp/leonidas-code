/**
 * Dev preview of the new-user setup: runs the real screens, tour and checklist from zero, writes no
 * files, and puts the real setup state back when it ends.
 */
import { SETUP_STATE_STORAGE_KEY } from "./setupState.logic";

const PREVIEW_KEY = "leonidas:setup-preview";

interface PreviewRecord {
  /** The real setup state before the preview, or null when there was none. */
  readonly backup: string | null;
}

export function isSetupPreview(): boolean {
  return localStorage.getItem(PREVIEW_KEY) !== null;
}

export function startSetupPreview(): void {
  // A second start keeps the first backup, so the real state is never lost.
  if (!isSetupPreview()) {
    const record: PreviewRecord = { backup: localStorage.getItem(SETUP_STATE_STORAGE_KEY) };
    localStorage.setItem(PREVIEW_KEY, JSON.stringify(record));
  }
  localStorage.removeItem(SETUP_STATE_STORAGE_KEY);
}

export function endSetupPreview(): void {
  const raw = localStorage.getItem(PREVIEW_KEY);
  if (raw === null) return;
  let backup: string | null = null;
  try {
    backup = (JSON.parse(raw) as PreviewRecord).backup;
  } catch {
    // A damaged record still ends the preview; there is no real state to restore.
  }
  if (backup === null) localStorage.removeItem(SETUP_STATE_STORAGE_KEY);
  else localStorage.setItem(SETUP_STATE_STORAGE_KEY, backup);
  localStorage.removeItem(PREVIEW_KEY);
}
