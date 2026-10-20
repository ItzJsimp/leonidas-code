import { ProviderInstanceId, type ProviderAuthState } from "@t3tools/contracts";
import { describe, expect, it } from "vite-plus/test";

import { getOpenRouterCardView, OPENROUTER_FAILED_FALLBACK } from "./openRouterSignIn.logic";

const auth = (patch: Partial<ProviderAuthState>): ProviderAuthState => ({
  instanceId: ProviderInstanceId.make("openrouter"),
  phase: "idle",
  flowId: null,
  authorizationUrl: null,
  expiresAt: null,
  message: null,
  ...patch,
});

describe("getOpenRouterCardView", () => {
  it("shows ready and install from the provider before any sign-in state", () => {
    expect(
      getOpenRouterCardView({ providerState: "ready", auth: auth({}), requested: false }),
    ).toEqual({ kind: "ready" });
    expect(
      getOpenRouterCardView({ providerState: "install", auth: undefined, requested: true }),
    ).toEqual({ kind: "install" });
  });

  it("offers sign-in when the free path is not connected yet", () => {
    expect(
      getOpenRouterCardView({ providerState: "disabled", auth: undefined, requested: false }),
    ).toEqual({ kind: "signIn" });
    expect(
      getOpenRouterCardView({
        providerState: "signIn",
        auth: auth({ phase: "failed", message: "old" }),
        requested: false,
      }),
    ).toEqual({ kind: "signIn" });
  });

  it("follows the browser sign-in through to finishing", () => {
    expect(
      getOpenRouterCardView({
        providerState: "attention",
        auth: auth({
          phase: "waiting",
          interaction: {
            type: "browser",
            id: "flow-1",
            url: "https://openrouter.ai/auth?x=1",
            requiresConsent: false,
          },
        }),
        requested: true,
      }),
    ).toEqual({ kind: "waiting", url: "https://openrouter.ai/auth?x=1" });
    expect(
      getOpenRouterCardView({
        providerState: "attention",
        auth: auth({ phase: "verifying" }),
        requested: true,
      }),
    ).toEqual({ kind: "finishing" });
    // The provider rebuild after the key saves can reset the flow to idle.
    expect(
      getOpenRouterCardView({
        providerState: "attention",
        auth: auth({ phase: "idle" }),
        requested: true,
      }),
    ).toEqual({ kind: "finishing" });
  });

  it("shows the server message on failure, with a plain fallback", () => {
    expect(
      getOpenRouterCardView({
        providerState: "signIn",
        auth: auth({ phase: "failed", message: "OpenRouter did not accept the sign-in." }),
        requested: true,
      }),
    ).toEqual({ kind: "failed", message: "OpenRouter did not accept the sign-in." });
    expect(
      getOpenRouterCardView({
        providerState: "signIn",
        auth: auth({ phase: "failed" }),
        requested: true,
      }),
    ).toEqual({ kind: "failed", message: OPENROUTER_FAILED_FALLBACK });
  });
});
