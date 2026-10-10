import type { DesktopBridge, DesktopUpdateState } from "@t3tools/contracts";
import { ArrowRightIcon } from "lucide-react";

import {
  getDesktopUpdateDownloadedVersion,
  getDesktopUpdateReleaseUrl,
  UPDATE_WHEN_SAFE_WAITING_LABEL,
} from "./desktopUpdate.logic";
import { toastManager } from "./ui/toast";

type DesktopUpdateShell = Pick<DesktopBridge, "openExternal">;

export async function openDesktopUpdateReleaseNotes(
  shell: DesktopUpdateShell | undefined,
  releaseUrl: string,
): Promise<void> {
  try {
    if (shell && (await shell.openExternal(releaseUrl))) return;
  } catch {
    // Surface rejected IPC calls through the same user-visible fallback.
  }
  toastManager.add({ type: "error", title: "Unable to open release notes" });
}

function ReleaseNotesLink({
  shell,
  releaseUrl,
}: {
  shell: DesktopUpdateShell;
  releaseUrl: string;
}) {
  return (
    <button
      className="ml-2 inline cursor-pointer text-muted-foreground underline decoration-dotted underline-offset-4 transition-colors hover:text-foreground"
      onClick={() => {
        void openDesktopUpdateReleaseNotes(shell, releaseUrl);
      }}
      type="button"
    >
      Read more
      <ArrowRightIcon
        aria-hidden
        className="ml-1 inline size-3 -rotate-45 align-[-0.125em]"
        strokeWidth={2.25}
      />
    </button>
  );
}

export function showDesktopUpdateDownloadedToast(
  shell: DesktopUpdateShell,
  state: DesktopUpdateState,
  actions: { readonly onRestartNow: () => void; readonly onUpdateWhenSafe: () => void },
): void {
  const version = getDesktopUpdateDownloadedVersion(state);
  const releaseUrl = getDesktopUpdateReleaseUrl(version);
  const toastId = toastManager.add({
    type: "success",
    title: "Update ready",
    description: (
      <>
        Leonidas Code{version ? ` ${version}` : ""} is ready to install.
        {releaseUrl ? <ReleaseNotesLink releaseUrl={releaseUrl} shell={shell} /> : null}
      </>
    ),
    timeout: 0,
    actionProps: {
      children: "Restart now",
      onClick: () => {
        toastManager.close(toastId);
        actions.onRestartNow();
      },
    },
    data: {
      actionLayout: "stacked-end",
      secondaryActionProps: {
        children: "Update when safe",
        onClick: () => {
          toastManager.close(toastId);
          actions.onUpdateWhenSafe();
        },
      },
    },
  });
}

/** Shown while "Update when safe" waits on running agents; returns the id so the caller can close it. */
export function showDesktopUpdateWaitingToast(onCancel: () => void) {
  return toastManager.add({
    type: "info",
    title: UPDATE_WHEN_SAFE_WAITING_LABEL,
    timeout: 0,
    actionProps: { children: "Cancel", onClick: onCancel },
  });
}
