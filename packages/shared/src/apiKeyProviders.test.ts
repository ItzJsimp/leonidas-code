import { describe, expect, it } from "vite-plus/test";

import { API_KEY_PROVIDERS, describeKeyTestResult, getApiKeyProvider } from "./apiKeyProviders.ts";

describe("API_KEY_PROVIDERS", () => {
  it("lists each provider once with a unique id and setting", () => {
    const ids = API_KEY_PROVIDERS.map((provider) => provider.id);
    const settings = API_KEY_PROVIDERS.map((provider) => provider.settingKey);
    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(settings).size).toBe(settings.length);
  });

  it.each(API_KEY_PROVIDERS.map((provider) => [provider.id, provider] as const))(
    "%s has the fields a guide needs",
    (_id, provider) => {
      expect(provider.label.length).toBeGreaterThan(0);
      expect(provider.purpose.length).toBeGreaterThan(0);
      expect(provider.freeTierNote.length).toBeGreaterThan(0);
      expect(provider.keyUrl).toMatch(/^https:\/\//);
      expect(provider.steps.length).toBeGreaterThanOrEqual(3);
      expect(provider.steps.length).toBeLessThanOrEqual(5);
      expect(provider.test.url).toMatch(/^https:\/\//);
      expect(provider.test.headers("abc")).toBeTypeOf("object");
    },
  );

  it("sends each key in the header the provider expects", () => {
    expect(getApiKeyProvider("groq")?.test.headers("gsk_x")).toEqual({
      Authorization: "Bearer gsk_x",
    });
    expect(getApiKeyProvider("artificialAnalysis")?.test.headers("k")).toEqual({
      "x-api-key": "k",
    });
  });

  it("keeps em dashes out of user-facing text", () => {
    for (const provider of API_KEY_PROVIDERS) {
      const text = [
        provider.label,
        provider.purpose,
        provider.freeTierNote,
        ...provider.steps,
      ].join(" ");
      expect(text).not.toContain("—");
    }
  });

  it("returns undefined for an unknown provider", () => {
    expect(getApiKeyProvider("nope")).toBeUndefined();
  });
});

describe("describeKeyTestResult", () => {
  const groq = getApiKeyProvider("groq")!;

  it("passes on a 200", () => {
    expect(describeKeyTestResult(groq, { status: 200 })).toEqual({
      ok: true,
      message: "The key works.",
    });
  });

  it("explains a rejected key in plain words", () => {
    for (const status of [401, 403]) {
      const result = describeKeyTestResult(groq, { status });
      expect(result.ok).toBe(false);
      expect(result.message).toContain("did not accept");
    }
  });

  it("explains a busy service and an unreachable network", () => {
    expect(describeKeyTestResult(groq, { status: 429 }).message).toContain("too many");
    expect(describeKeyTestResult(groq, { status: 503 }).message).toContain("not available");
    expect(describeKeyTestResult(groq, { status: null }).message).toContain("Check your internet");
  });
});
