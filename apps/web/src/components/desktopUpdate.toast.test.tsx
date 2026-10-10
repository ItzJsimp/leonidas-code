import { isValidElement, type ReactElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import type { DesktopUpdateState } from "@t3tools/contracts";

const testState = vi.hoisted(() => ({
  addToast: vi.fn((_toast: unknown) => "toast-1"),
  closeToast: vi.fn(),
}));

vi.mock("./ui/toast", () => ({
  toastManager: { add: testState.addToast, close: testState.closeToast },
}));

import { showDesktopUpdateDownloadedToast } from "./desktopUpdate.toast";

type ClickableElement = ReactElement<{ readonly onClick?: () => void }>;

/** Walks the rendered description, invoking function components, to find the link button. */
function findReleaseNotesLink(node: ReactNode): ClickableElement | null {
  if (Array.isArray(node)) {
    for (const child of node) {
      const found = findReleaseNotesLink(child);
      if (found) return found;
    }
    return null;
  }
  if (!isValidElement(node)) return null;
  const element = node as ReactElement<{ readonly children?: ReactNode }>;
  if (element.type === "button") return element as ClickableElement;
  if (typeof element.type === "function") {
    const render = element.type as (props: unknown) => ReactNode;
    return findReleaseNotesLink(render(element.props));
  }
  return findReleaseNotesLink(element.props.children);
}

const noActions = { onRestartNow: vi.fn(), onUpdateWhenSafe: vi.fn() };

function getDescription(): ReactNode {
  const toast = testState.addToast.mock.calls[0]?.[0] as { description?: ReactNode } | undefined;
  return toast?.description ?? null;
}

function downloadedState(overrides: Partial<DesktopUpdateState> = {}): DesktopUpdateState {
  return {
    enabled: true,
    status: "downloaded",
    channel: "latest",
    currentVersion: "0.0.29",
    hostArch: "arm64",
    appArch: "arm64",
    runningUnderArm64Translation: false,
    availableVersion: "0.0.30",
    downloadedVersion: "0.0.30",
    releaseNotes: [],
    omittedReleaseCount: 0,
    downloadPercent: 100,
    checkedAt: null,
    message: null,
    errorContext: null,
    canRetry: true,
    ...overrides,
  };
}

describe("showDesktopUpdateDownloadedToast", () => {
  beforeEach(() => {
    testState.addToast.mockClear();
    testState.closeToast.mockClear();
  });

  it("offers Restart now and Update when safe, and stays open until acted on", () => {
    const onRestartNow = vi.fn();
    const onUpdateWhenSafe = vi.fn();

    showDesktopUpdateDownloadedToast({ openExternal: vi.fn() }, downloadedState(), {
      onRestartNow,
      onUpdateWhenSafe,
    });
    const toast = testState.addToast.mock.calls[0]?.[0] as unknown as {
      title: string;
      timeout: number;
      actionProps: { children: string; onClick: () => void };
      data: { secondaryActionProps: { children: string; onClick: () => void } };
    };

    expect(toast.title).toBe("Update ready");
    expect(toast.timeout).toBe(0);
    expect(toast.actionProps.children).toBe("Restart now");
    expect(toast.data.secondaryActionProps.children).toBe("Update when safe");
    toast.actionProps.onClick();
    toast.data.secondaryActionProps.onClick();
    expect(onRestartNow).toHaveBeenCalledTimes(1);
    expect(onUpdateWhenSafe).toHaveBeenCalledTimes(1);
    expect(testState.closeToast).toHaveBeenCalledTimes(2);
  });

  it("opens the downloaded version's release notes", async () => {
    const openExternal = vi.fn().mockResolvedValue(true);

    showDesktopUpdateDownloadedToast({ openExternal }, downloadedState(), noActions);
    const link = findReleaseNotesLink(getDescription());
    link?.props.onClick?.();
    await vi.waitFor(() => {
      expect(openExternal).toHaveBeenCalledWith(
        "https://github.com/pingdotgg/t3code/releases/tag/v0.0.30",
      );
    });
    expect(testState.addToast).toHaveBeenCalledTimes(1);
  });

  it("falls back to the version the download was started for", async () => {
    const openExternal = vi.fn().mockResolvedValue(true);

    // The `update-downloaded` event can land after the download RPC resolves.
    showDesktopUpdateDownloadedToast(
      { openExternal },
      downloadedState({ downloadedVersion: null }),
      noActions,
    );
    findReleaseNotesLink(getDescription())?.props.onClick?.();

    await vi.waitFor(() => {
      expect(openExternal).toHaveBeenCalledWith(
        "https://github.com/pingdotgg/t3code/releases/tag/v0.0.30",
      );
    });
  });

  it("omits the link when the updater reports no version at all", () => {
    showDesktopUpdateDownloadedToast(
      { openExternal: vi.fn() },
      downloadedState({ availableVersion: null, downloadedVersion: null }),
      noActions,
    );

    expect(findReleaseNotesLink(getDescription())).toBeNull();
  });

  it.each([
    ["returns false", vi.fn().mockResolvedValue(false)],
    ["rejects", vi.fn().mockRejectedValue(new Error("open failed"))],
  ])("shows an error when opening release notes %s", async (_description, openExternal) => {
    showDesktopUpdateDownloadedToast({ openExternal }, downloadedState(), noActions);
    findReleaseNotesLink(getDescription())?.props.onClick?.();

    await vi.waitFor(() => {
      expect(testState.addToast).toHaveBeenLastCalledWith({
        type: "error",
        title: "Unable to open release notes",
      });
    });
  });
});
