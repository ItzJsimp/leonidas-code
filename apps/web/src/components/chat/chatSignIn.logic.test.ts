import { describe, expect, it } from "vite-plus/test";

import {
  CHAT_SIGN_IN_DONE_MESSAGE,
  CHAT_SIGN_IN_PROMPT,
  getChatSignInState,
} from "./chatSignIn.logic";

const base = { requested: false, authenticated: false, error: null };

describe("getChatSignInState", () => {
  it("offers the Sign in button when idle", () => {
    expect(getChatSignInState({ ...base, view: { kind: "idle" } })).toEqual({
      kind: "ready",
      detail: CHAT_SIGN_IN_PROMPT,
      label: "Sign in with Claude",
    });
  });

  it("shows the browser step with the page link while waiting", () => {
    const state = getChatSignInState({
      ...base,
      requested: true,
      view: { kind: "waiting", url: "https://claude.ai/x", canCancel: true },
    });
    expect(state).toMatchObject({ kind: "waiting", url: "https://claude.ai/x", canCancel: true });
  });

  it("shows a checking state while the server verifies", () => {
    expect(getChatSignInState({ ...base, requested: true, view: { kind: "finishing" } }).kind).toBe(
      "finishing",
    );
  });

  it("offers a retry with the failure text", () => {
    expect(
      getChatSignInState({ ...base, requested: true, view: { kind: "failed", message: "No." } }),
    ).toEqual({ kind: "ready", detail: "No.", label: "Try again" });
    expect(
      getChatSignInState({ ...base, view: { kind: "idle" }, error: "Could not start." }),
    ).toEqual({
      kind: "ready",
      detail: "Could not start.",
      label: "Try again",
    });
  });

  it("tells the user to send the message again after this client signed in", () => {
    expect(
      getChatSignInState({ ...base, requested: true, authenticated: true, view: { kind: "idle" } }),
    ).toEqual({ kind: "done", detail: CHAT_SIGN_IN_DONE_MESSAGE });
  });

  it("hides on an old failure when the account is already signed in", () => {
    expect(getChatSignInState({ ...base, authenticated: true, view: { kind: "idle" } })).toEqual({
      kind: "hidden",
    });
  });
});
