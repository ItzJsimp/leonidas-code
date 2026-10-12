import { describe, expect, it } from "vite-plus/test";
import {
  OpenRouterSettings,
  ProviderDriverKind,
  DEFAULT_MODEL_BY_PROVIDER,
  PROVIDER_DISPLAY_NAMES,
} from "@t3tools/contracts";
import * as Schema from "effect/Schema";
import { OpenRouterDriver } from "./OpenRouterDriver.ts";

describe("OpenRouterDriver", () => {
  it("exposes the openrouter driverKind and metadata", () => {
    expect(OpenRouterDriver.driverKind).toBe(ProviderDriverKind.make("openrouter"));
    expect(OpenRouterDriver.metadata.displayName).toBe("OpenRouter");
    expect(OpenRouterDriver.metadata.supportsMultipleInstances).toBe(true);
  });

  it("decodes default OpenRouterSettings with expected defaults", () => {
    const decode = Schema.decodeSync(OpenRouterSettings);
    const settings = decode({});
    expect(settings.enabled).toBe(false);
    expect(settings.apiKey).toBe("");
    expect(settings.baseUrl).toBe("https://openrouter.ai/api");
    expect(settings.binaryPath).toBe("claude");
    expect(settings.homePath).toBe("");
    expect(settings.launchArgs).toBe("");
    expect(settings.customModels).toEqual([]);
  });

  it("decodes custom OpenRouterSettings", () => {
    const decode = Schema.decodeSync(OpenRouterSettings);
    const settings = decode({
      enabled: true,
      apiKey: "sk-or-v1-my-secret-key",
      baseUrl: "https://custom.router/v1",
      customModels: ["anthropic/claude-3.7-sonnet", "deepseek/deepseek-r1"],
    });
    expect(settings.enabled).toBe(true);
    expect(settings.apiKey).toBe("sk-or-v1-my-secret-key");
    expect(settings.baseUrl).toBe("https://custom.router/v1");
    expect(settings.customModels).toEqual(["anthropic/claude-3.7-sonnet", "deepseek/deepseek-r1"]);
  });

  it("registers OpenRouter in default model mappings and display names", () => {
    const kind = ProviderDriverKind.make("openrouter");
    expect(DEFAULT_MODEL_BY_PROVIDER[kind]).toBe("openrouter/free");
    expect(PROVIDER_DISPLAY_NAMES[kind]).toBe("OpenRouter");
  });
});
