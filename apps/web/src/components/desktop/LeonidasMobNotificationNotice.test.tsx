import type React from "react";
import { describe, expect, it, vi, beforeEach } from "vite-plus/test";
import {
  MOB_NOTIFICATION_TEST_MESSAGE,
  MOB_NOTIFICATION_TEST_STORAGE_KEY,
  showMobNotificationTestToast,
} from "./LeonidasMobNotificationNotice";
import { toastManager } from "../ui/toast";

vi.mock("../ui/toast", () => ({
  toastManager: {
    add: vi.fn().mockReturnValue("toast-test-id"),
    close: vi.fn(),
  },
}));

vi.mock("../../threadNotifications", () => ({
  playNotificationSound: vi.fn().mockResolvedValue(undefined),
  unlockNotificationAudio: vi.fn(),
}));

describe("LeonidasMobNotificationNotice", () => {
  let mockStorage: Record<string, string> = {};

  beforeEach(() => {
    vi.clearAllMocks();
    mockStorage = {};
    const storageMock = {
      getItem: vi.fn((key: string) => mockStorage[key] ?? null),
      setItem: vi.fn((key: string, value: string) => {
        mockStorage[key] = value;
      }),
      removeItem: vi.fn((key: string) => {
        delete mockStorage[key];
      }),
      clear: vi.fn(() => {
        mockStorage = {};
      }),
    };
    vi.stubGlobal("localStorage", storageMock);
  });

  it("exposes the exact user requested verification message", () => {
    expect(MOB_NOTIFICATION_TEST_MESSAGE).toBe(
      "Hey Mob, this is an update that Jake sent to make sure notifications are working. This is a test, can you verify to him that this is working?",
    );
  });

  it("shows an unmissable persistent toast with verification actions", () => {
    const id = showMobNotificationTestToast();
    expect(id).toBe("toast-test-id");
    expect(toastManager.add).toHaveBeenCalledTimes(1);

    const callArg = vi.mocked(toastManager.add).mock.calls[0]?.[0] as
      | {
          title?: string;
          description?: string;
          timeout?: number;
          actionProps?: { children?: string };
        }
      | undefined;
    expect(callArg?.title).toContain("Leonidas Notification Test");
    expect(callArg?.description).toBe(MOB_NOTIFICATION_TEST_MESSAGE);
    expect(callArg?.timeout).toBe(0);
    expect(callArg?.actionProps?.children).toBe("Verify & Confirm");
  });

  it("marks as acknowledged in localStorage when confirmed", () => {
    showMobNotificationTestToast();

    const callArg = vi.mocked(toastManager.add).mock.calls[0]?.[0] as
      | {
          actionProps?: { onClick?: (e: unknown) => void };
        }
      | undefined;
    const clickHandler = callArg?.actionProps?.onClick;
    if (clickHandler) {
      clickHandler({} as React.MouseEvent<HTMLButtonElement>);
    }

    expect(localStorage.setItem).toHaveBeenCalledWith(
      MOB_NOTIFICATION_TEST_STORAGE_KEY,
      "acknowledged",
    );
    expect(toastManager.close).toHaveBeenCalledWith("toast-test-id");
  });
});
