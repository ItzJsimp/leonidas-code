// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vite-plus/test";

import { SETUP_STATE_STORAGE_KEY } from "./setupState.logic";
import { endSetupPreview, isSetupPreview, startSetupPreview } from "./setupPreview";

beforeEach(() => localStorage.clear());

describe("setup preview", () => {
  it("starts from a fresh setup and puts the real state back at the end", () => {
    localStorage.setItem(SETUP_STATE_STORAGE_KEY, '{"real":true}');
    startSetupPreview();
    expect(isSetupPreview()).toBe(true);
    expect(localStorage.getItem(SETUP_STATE_STORAGE_KEY)).toBeNull();

    localStorage.setItem(SETUP_STATE_STORAGE_KEY, '{"preview":true}');
    endSetupPreview();
    expect(isSetupPreview()).toBe(false);
    expect(localStorage.getItem(SETUP_STATE_STORAGE_KEY)).toBe('{"real":true}');
  });

  it("leaves no setup state behind when there was none before", () => {
    startSetupPreview();
    localStorage.setItem(SETUP_STATE_STORAGE_KEY, '{"preview":true}');
    endSetupPreview();
    expect(localStorage.getItem(SETUP_STATE_STORAGE_KEY)).toBeNull();
  });

  it("keeps the first backup when a preview is started twice", () => {
    localStorage.setItem(SETUP_STATE_STORAGE_KEY, '{"real":true}');
    startSetupPreview();
    localStorage.setItem(SETUP_STATE_STORAGE_KEY, '{"preview":true}');
    startSetupPreview();
    endSetupPreview();
    expect(localStorage.getItem(SETUP_STATE_STORAGE_KEY)).toBe('{"real":true}');
  });
});
