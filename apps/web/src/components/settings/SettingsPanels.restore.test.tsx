import { DEFAULT_UNIFIED_SETTINGS, type UnifiedSettings } from "@t3tools/contracts";
import { EFFECTIVE_SERVER_SETTINGS_DEFAULTS } from "@t3tools/shared/serverSettings";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

import { reactHookHarness as hooks } from "../../test/reactHookHarness";

/**
 * What a machine that has chosen nothing looks like: the schema defaults with
 * the fork's team defaults folded in. The server applies the team defaults, so
 * a pristine client sees those values.
 */
const PRISTINE_SETTINGS: UnifiedSettings = {
  ...DEFAULT_UNIFIED_SETTINGS,
  continueThreadsAfterServerUpdate:
    EFFECTIVE_SERVER_SETTINGS_DEFAULTS.continueThreadsAfterServerUpdate,
};

const state = vi.hoisted(() => ({
  settings: null as UnifiedSettings | null,
  update: vi.fn(),
  confirm: vi.fn(),
}));

vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  const { reactHookHarness } = await import("../../test/reactHookHarness");
  return {
    ...actual,
    useCallback: reactHookHarness.useCallback,
    useMemo: reactHookHarness.useMemo,
  };
});

vi.mock("react/compiler-runtime", async () => {
  const { reactHookHarness } = await import("../../test/reactHookHarness");
  return { c: reactHookHarness.useMemoCache };
});

vi.mock("../../hooks/useTheme", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../hooks/useTheme")>()),
  useTheme: () => ({
    theme: "system",
    followSystem: true,
    themeHalves: null,
    setTheme: vi.fn(),
    setFollowSystem: vi.fn(),
    setThemeHalf: vi.fn(),
    clearThemeHalves: vi.fn(),
  }),
  readThemePreference: () => "system",
  readThemeHalves: () => null,
  readAppearanceModePreference: () => "system",
}));

vi.mock("./useScopedSettings", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./useScopedSettings")>()),
  useScopedSettings: () => state.settings,
  useUpdateScopedSettings: () => state.update,
}));

vi.mock("../../localApi", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../localApi")>()),
  readLocalApi: () => ({ dialogs: { confirm: state.confirm } }),
}));

import { useSettingsRestore } from "./SettingsPanels";

beforeEach(() => {
  hooks.reset();
  vi.clearAllMocks();
  state.settings = { ...PRISTINE_SETTINGS };
  state.confirm.mockResolvedValue(true);
});

describe("restoring V2 settings", () => {
  it("restores prediction costs and mode together", async () => {
    state.settings = {
      ...PRISTINE_SETTINGS,
      promptPredictionMode: "cloud",
      promptPredictionLocalModel: "local-model",
      promptPredictionCloudRequestLimit: 10,
      promptPredictionModelSelection: { ...DEFAULT_UNIFIED_SETTINGS.textGenerationModelSelection },
    };
    hooks.beginRender();
    const restore = useSettingsRestore();
    expect(restore.changedSettingLabels).toContain("Prediction source and limit");
    await restore.restoreDefaults();
    expect(state.update.mock.calls[0]?.[0]).toMatchObject({
      promptPredictionMode: "local",
      promptPredictionLocalModel: "",
      promptPredictionModelSelection: null,
      promptPredictionCloudRequestLimit: 30,
    });
  });
  it.each([
    ["persistComposerContextStrip", "Message box context"],
    ["autoResumeLimitedThreads", "Continue paused chats when the limit ends"],
    ["snoozeLimitedThreads", "Pause chats that reach a usage limit"],
  ] as const)("restores %s when it is the only changed setting", async (key, label) => {
    state.settings = { ...PRISTINE_SETTINGS, [key]: true };
    hooks.beginRender();
    const restore = useSettingsRestore();

    expect(restore.changedSettingLabels).toEqual([label]);
    await restore.restoreDefaults();

    expect(state.confirm.mock.calls[0]?.[0]).toContain(label);
    expect(state.update).toHaveBeenCalledOnce();
    expect(state.update.mock.calls[0]?.[0][key]).toBe(DEFAULT_UNIFIED_SETTINGS[key]);
  });

  // A machine still on the schema default is modified relative to the fork's
  // team default, and Reset must return it to the team default rather than
  // pinning the schema default.
  it("treats the schema default as changed when a team default covers it", async () => {
    state.settings = { ...PRISTINE_SETTINGS, continueThreadsAfterServerUpdate: false };
    hooks.beginRender();
    const restore = useSettingsRestore();

    expect(restore.changedSettingLabels).toContain("Continue chats after restarts");
    await restore.restoreDefaults();

    expect(state.update.mock.calls[0]?.[0].continueThreadsAfterServerUpdate).toBe(
      EFFECTIVE_SERVER_SETTINGS_DEFAULTS.continueThreadsAfterServerUpdate,
    );
  });

  it("does not reset settings after cancellation", async () => {
    state.settings = { ...PRISTINE_SETTINGS, autoResumeLimitedThreads: true };
    state.confirm.mockResolvedValue(false);
    hooks.beginRender();

    await useSettingsRestore().restoreDefaults();

    expect(state.confirm).toHaveBeenCalledOnce();
    expect(state.update).not.toHaveBeenCalled();
  });
});
