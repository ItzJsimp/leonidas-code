import { useAtomValue } from "@effect/atom-react";
import { useEffect, useRef, useState } from "react";

import { ensureLocalApi } from "../../localApi";
import { useDesktopUpdateState, useUpdateWhenSafeStore } from "../../state/desktopUpdate";
import { runningThreadCountAtom } from "../../state/threads";
import {
  getDesktopUpdateActionError,
  getDesktopUpdateDownloadedVersion,
  getDesktopUpdateInstallConfirmationMessage,
  getWhatsNewItems,
  resolveUpdateWhenSafeAction,
} from "../desktopUpdate.logic";
import {
  showDesktopUpdateDownloadedToast,
  showDesktopUpdateWaitingToast,
} from "../desktopUpdate.toast";
import { stackedThreadToast, toastManager } from "../ui/toast";
import { playTestSound } from "./LeonidasMobNotificationNotice";
import { LeonidasWhatsNewDialog } from "./LeonidasWhatsNewDialog";

function toastInstallError(description: string) {
  toastManager.add(
    stackedThreadToast({ type: "error", title: "Could not install update", description }),
  );
}

async function installUpdate(): Promise<void> {
  try {
    const result = await window.desktopBridge?.installUpdate();
    const actionError = result ? getDesktopUpdateActionError(result) : null;
    if (actionError) toastInstallError(actionError);
  } catch (error) {
    toastInstallError(error instanceof Error ? error.message : "An unexpected error occurred.");
  }
}

/**
 * Desktop only. Shows the "Update ready" toast once per downloaded version and
 * runs "Update when safe": it installs the moment no agent thread is running.
 */
export function DesktopUpdateCoordinator() {
  const state = useDesktopUpdateState();
  const runningCount = useAtomValue(runningThreadCountAtom);
  const updateWhenSafe = useUpdateWhenSafeStore((store) => store.updateWhenSafe);
  const setUpdateWhenSafe = useUpdateWhenSafeStore((store) => store.setUpdateWhenSafe);
  const runningCountRef = useRef(runningCount);
  runningCountRef.current = runningCount;
  const toastedVersionRef = useRef<string | null>(null);
  const [whatsNew, setWhatsNew] = useState<{
    readonly version: string;
    readonly items: ReadonlyArray<string>;
    readonly actions: { readonly onRestartNow: () => void; readonly onUpdateWhenSafe: () => void };
  } | null>(null);

  const downloadedVersion =
    state?.status === "downloaded" ? getDesktopUpdateDownloadedVersion(state) : null;
  useEffect(() => {
    const bridge = window.desktopBridge;
    if (!bridge || !state || !downloadedVersion) return;
    if (toastedVersionRef.current === downloadedVersion) return;
    toastedVersionRef.current = downloadedVersion;
    const actions = {
      onRestartNow: () => {
        void (async () => {
          if (runningCountRef.current > 0) {
            try {
              const confirmed = await ensureLocalApi().dialogs.confirm(
                getDesktopUpdateInstallConfirmationMessage(state),
              );
              if (!confirmed) return;
            } catch (error) {
              toastInstallError(
                error instanceof Error ? error.message : "Update confirmation failed.",
              );
              return;
            }
          }
          await installUpdate();
        })();
      },
      onUpdateWhenSafe: () => setUpdateWhenSafe(true),
    };
    const items = getWhatsNewItems(state);
    if (items.length === 0) {
      showDesktopUpdateDownloadedToast(bridge, state, actions);
      return;
    }
    playTestSound();
    setWhatsNew({ version: downloadedVersion, items, actions });
    // `state` only feeds the toast copy; the version is the once-per-update key.
  }, [downloadedVersion, setUpdateWhenSafe]);

  const whenSafeAction = resolveUpdateWhenSafeAction(runningCount, updateWhenSafe);
  useEffect(() => {
    if (whenSafeAction === "install") {
      setUpdateWhenSafe(false);
      void installUpdate();
      return;
    }
    if (whenSafeAction !== "wait") return;
    const toastId = showDesktopUpdateWaitingToast(() => setUpdateWhenSafe(false));
    return () => toastManager.close(toastId);
  }, [whenSafeAction, setUpdateWhenSafe]);

  return whatsNew ? (
    <LeonidasWhatsNewDialog
      version={whatsNew.version}
      items={whatsNew.items}
      onRestartNow={whatsNew.actions.onRestartNow}
      onUpdateWhenSafe={whatsNew.actions.onUpdateWhenSafe}
      onClose={() => setWhatsNew(null)}
    />
  ) : null;
}
