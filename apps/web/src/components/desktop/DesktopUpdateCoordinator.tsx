import { useAtomValue } from "@effect/atom-react";
import { useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";

import { useTourStore } from "../../features/tour/tourStore";
import { isTourTargetId, type TourTargetId } from "../../features/tour/tourTargets";
import { ensureLocalApi } from "../../localApi";
import { useDesktopUpdateState, useUpdateWhenSafeStore } from "../../state/desktopUpdate";
import { runningThreadCountAtom } from "../../state/threads";
import {
  createFeatureWalkthroughPrompt,
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
import { playUpdateReadySound } from "./updateReadySound";
import { LeonidasWhatsNewDialog } from "./LeonidasWhatsNewDialog";
import { fetchLatestReleaseWhatsNew, onWhatsNewPreviewRequested } from "./whatsNewPreview";

const PENDING_FEATURE_WALKTHROUGH_KEY = "leonidas:pending-feature-walkthrough:v1";

interface PendingFeatureWalkthrough {
  readonly version: string;
  readonly prompt: string;
  readonly tourId?: TourTargetId;
}

function readPendingFeatureWalkthrough(): PendingFeatureWalkthrough | null {
  try {
    const raw = window.localStorage.getItem(PENDING_FEATURE_WALKTHROUGH_KEY);
    if (!raw) return null;
    const value: unknown = JSON.parse(raw);
    if (typeof value !== "object" || value === null) return null;
    const candidate = value as {
      readonly version?: unknown;
      readonly prompt?: unknown;
      readonly tourId?: unknown;
    };
    return typeof candidate.version === "string" &&
      candidate.version.length <= 100 &&
      typeof candidate.prompt === "string" &&
      candidate.prompt.length <= 1200
      ? {
          version: candidate.version,
          prompt: candidate.prompt,
          ...(typeof candidate.tourId === "string" && isTourTargetId(candidate.tourId)
            ? { tourId: candidate.tourId }
            : {}),
        }
      : null;
  } catch {
    return null;
  }
}

function savePendingFeatureWalkthrough(value: PendingFeatureWalkthrough): boolean {
  try {
    window.localStorage.setItem(PENDING_FEATURE_WALKTHROUGH_KEY, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

function clearPendingFeatureWalkthrough(): void {
  try {
    window.localStorage.removeItem(PENDING_FEATURE_WALKTHROUGH_KEY);
  } catch {
    // The guide stays available in update history if local storage is unavailable.
  }
}

function sameReleaseVersion(left: string, right: string): boolean {
  return left.trim().replace(/^v/i, "") === right.trim().replace(/^v/i, "");
}

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
  const navigate = useNavigate();
  const runningCount = useAtomValue(runningThreadCountAtom);
  const updateWhenSafe = useUpdateWhenSafeStore((store) => store.updateWhenSafe);
  const autoUpdateWhenSafe = useUpdateWhenSafeStore((store) => store.autoUpdateWhenSafe);
  const setAutoUpdateWhenSafe = useUpdateWhenSafeStore((store) => store.setAutoUpdateWhenSafe);
  const setUpdateWhenSafe = useUpdateWhenSafeStore((store) => store.setUpdateWhenSafe);
  const currentVersion = state?.currentVersion;
  const runningCountRef = useRef(runningCount);
  runningCountRef.current = runningCount;
  const toastedVersionRef = useRef<string | null>(null);
  const [whatsNew, setWhatsNew] = useState<{
    readonly version: string;
    readonly items: ReadonlyArray<string>;
    readonly actions?: { readonly onRestartNow: () => void; readonly onUpdateWhenSafe: () => void };
  } | null>(null);

  const showMe = useCallback(
    (item: string, tourId: TourTargetId | null) => {
      const prompt = createFeatureWalkthroughPrompt(item);
      const updateActions = whatsNew?.actions;
      if (
        updateActions &&
        whatsNew.version &&
        savePendingFeatureWalkthrough({
          version: whatsNew.version,
          prompt,
          ...(tourId ? { tourId } : {}),
        })
      ) {
        setWhatsNew(null);
        updateActions.onRestartNow();
        return;
      }
      setWhatsNew(null);
      if (tourId) {
        useTourStore.getState().start([tourId]);
        return;
      }
      void navigate({ to: "/", search: { guidePrompt: prompt } });
    },
    [navigate, whatsNew],
  );

  useEffect(() => {
    if (!currentVersion) return;
    const pending = readPendingFeatureWalkthrough();
    if (!pending || !sameReleaseVersion(pending.version, currentVersion)) return;
    clearPendingFeatureWalkthrough();
    if (pending.tourId) {
      useTourStore.getState().start([pending.tourId]);
      return;
    }
    void navigate({ to: "/", search: { guidePrompt: pending.prompt } });
  }, [currentVersion, navigate]);

  // Settings > About "Preview": same popup, real latest-release bullets, no install buttons.
  useEffect(
    () =>
      onWhatsNewPreviewRequested(() => {
        void fetchLatestReleaseWhatsNew().then(({ version, items }) =>
          setWhatsNew({ version, items }),
        );
      }),
    [],
  );

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
    const items = getWhatsNewItems(state, downloadedVersion);
    if (items.length === 0) {
      showDesktopUpdateDownloadedToast(bridge, state, actions);
      return;
    }
    playUpdateReadySound();
    setWhatsNew({ version: downloadedVersion, items, actions });
    // `state` only feeds the toast copy; the version is the once-per-update key.
  }, [downloadedVersion, setUpdateWhenSafe]);

  const whenSafeAction = resolveUpdateWhenSafeAction(
    runningCount,
    downloadedVersion !== null && (updateWhenSafe || autoUpdateWhenSafe),
  );
  const setDraining = useUpdateWhenSafeStore((store) => store.setDraining);
  useEffect(() => {
    setDraining(whenSafeAction === "wait");
    return () => setDraining(false);
  }, [whenSafeAction, setDraining]);
  const installingVersionRef = useRef<string | null>(null);
  const waitToastedVersionRef = useRef<string | null>(null);
  useEffect(() => {
    if (whenSafeAction === "install") {
      if (installingVersionRef.current === downloadedVersion) return;
      installingVersionRef.current = downloadedVersion;
      setUpdateWhenSafe(false);
      void installUpdate();
      return;
    }
    if (whenSafeAction !== "wait") return;
    // The periodic update check flips the state off and on "downloaded"; announce once per version.
    if (waitToastedVersionRef.current === downloadedVersion) return;
    waitToastedVersionRef.current = downloadedVersion;
    const toastId = showDesktopUpdateWaitingToast(
      () => {
        setUpdateWhenSafe(false);
        if (autoUpdateWhenSafe) setAutoUpdateWhenSafe(false);
      },
      autoUpdateWhenSafe ? "Turn off automatic updates" : "Cancel",
    );
    return () => toastManager.close(toastId);
  }, [
    whenSafeAction,
    setUpdateWhenSafe,
    downloadedVersion,
    autoUpdateWhenSafe,
    setAutoUpdateWhenSafe,
  ]);

  return whatsNew ? (
    <LeonidasWhatsNewDialog
      version={whatsNew.version}
      items={whatsNew.items}
      onShowMe={showMe}
      onRestartNow={whatsNew.actions?.onRestartNow}
      onUpdateWhenSafe={whatsNew.actions?.onUpdateWhenSafe}
      onClose={() => setWhatsNew(null)}
    />
  ) : null;
}
