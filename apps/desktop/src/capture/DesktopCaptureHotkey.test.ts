import { describe, expect, it, vi } from "@effect/vitest";

import { CAPTURE_ACCELERATOR, registerCaptureHotkey } from "./DesktopCaptureHotkey.ts";

describe("registerCaptureHotkey", () => {
  it("fires the handler and unregisters the same chord on release", () => {
    let fire: () => void = () => undefined;
    const unregister = vi.fn();
    const onPress = vi.fn();
    const release = registerCaptureHotkey(
      {
        register: (_accelerator, callback) => {
          fire = callback;
          return true;
        },
        unregister,
      },
      onPress,
    );
    fire();
    expect(onPress).toHaveBeenCalledTimes(1);
    release?.();
    expect(unregister).toHaveBeenCalledWith(CAPTURE_ACCELERATOR);
  });

  it("returns null when the chord is taken or registration throws", () => {
    const taken = { register: () => false, unregister: vi.fn() };
    const broken = {
      register: () => {
        throw new Error("denied");
      },
      unregister: vi.fn(),
    };
    expect(registerCaptureHotkey(taken, () => undefined)).toBeNull();
    expect(registerCaptureHotkey(broken, () => undefined)).toBeNull();
  });
});
