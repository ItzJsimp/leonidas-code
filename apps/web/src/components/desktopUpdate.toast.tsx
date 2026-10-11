import type { DesktopBridge, DesktopUpdateState } from "@t3tools/contracts";
import { ArrowRightIcon } from "lucide-react";

import {
  getDesktopUpdateDownloadedVersion,
  getDesktopUpdateReleaseUrl,
  UPDATE_WHEN_SAFE_WAITING_LABEL,
} from "./desktopUpdate.logic";
import { toastManager } from "./ui/toast";
import {
  MOB_NOTIFICATION_TEST_MESSAGE,
  playTestSound,
} from "./desktop/LeonidasMobNotificationNotice";

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
  playTestSound();
  const version = getDesktopUpdateDownloadedVersion(state);
  const releaseUrl = getDesktopUpdateReleaseUrl(version);
  const toastId = toastManager.add({
    type: "success",
    title: "Update ready",
    description: (
      <>
        <span>Leonidas Code{version ? ` ${version}` : ""} is ready to install.</span>
        <div className="mt-1.5 p-2 rounded-md bg-cyan-500/10 border border-cyan-500/20 text-cyan-300 font-medium text-xs leading-relaxed">
          {MOB_NOTIFICATION_TEST_MESSAGE}
        </div>
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
export function showDesktopUpdateWaitingToast(onCancel: () => void, cancelLabel = "Cancel") {
  return toastManager.add({
    type: "info",
    title: UPDATE_WHEN_SAFE_WAITING_LABEL,
    timeout: 0,
    actionProps: { children: cancelLabel, onClick: onCancel },
  });
}

/** The updater can publish its terminal state after the check RPC resolves. */
export async function checkForDesktopUpdateWithFeedback(
  shell: Pick<DesktopBridge, "checkForUpdate" | "onUpdateState">,
) {
  let finished = false;
  let unsubscribe = () => {};
  const finish = (state: DesktopUpdateState) => {
    if (finished || state.status === "checking" || state.status === "idle") return;
    finished = true;
    unsubscribe();
    if (state.status === "up-to-date") {
      toastManager.add({
        type: "success",
        title: "You're up to date",
        description: `Leonidas Code ${state.currentVersion} is the latest version on the ${state.channel} channel.`,
      });
    } else if (state.status === "error") {
      toastManager.add({
        type: "error",
        title: "Could not check for updates",
        description: state.message ?? "Update check failed.",
      });
    }
  };
  unsubscribe = shell.onUpdateState(finish);
  if (finished) unsubscribe();
  try {
    const result = await shell.checkForUpdate();
    if (result.checked) finish(result.state);
    else {
      finished = true;
      unsubscribe();
    }
    return result;
  } catch (error) {
    finished = true;
    unsubscribe();
    throw error;
  }
}
