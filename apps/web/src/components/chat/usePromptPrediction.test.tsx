// @vitest-environment jsdom
import { LIVE_REFRESH_MIN_INTERVAL_MS } from "~/hooks/useLiveRefresh";
import { act, useLayoutEffect } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import type { PromptCandidate, PromptPredictionMessage } from "@t3tools/shared/promptPrediction";

const rpc = vi.hoisted(() => ({
  candidates: vi.fn(),
  predict: vi.fn(),
  cancel: vi.fn(),
}));
vi.mock("@t3tools/client-runtime/state/runtime", () => ({
  createEnvironmentRpcQueryAtomFamily: (_: unknown, options: { tag: string }) => options.tag,
  createEnvironmentRpcCommand: (_: unknown, options: { tag: string }) => options.tag,
}));
vi.mock("../../connection/runtime", () => ({ connectionAtomRuntime: {} }));
vi.mock("../../state/use-atom-query-runner", () => ({
  useAtomQueryRunner: (tag: string) =>
    tag === "projects.predictPrompt" ? rpc.predict : rpc.candidates,
}));
vi.mock("../../state/use-atom-command", () => ({ useAtomCommand: () => rpc.cancel }));

import { usePromptPrediction, personalExamplesFor, transcriptFor } from "./usePromptPrediction";

const assistant: PromptPredictionMessage[] = [{ role: "assistant", text: "The task is ready." }];
type State = {
  draft: string;
  focused: boolean;
  mode: "local" | "local-model" | "cloud";
  messages: PromptPredictionMessage[];
  running: boolean;
};
let state: State;
let latest: readonly PromptCandidate[];
let root: Root;
let container: HTMLDivElement;
let hidden = false;

function Probe({ value }: { value: State }) {
  const candidates = usePromptPrediction(
    "environment" as never,
    "C:/repo",
    value.messages,
    value.running,
    {
      draft: value.draft,
      focused: value.focused,
      mode: value.mode,
    },
  );
  useLayoutEffect(() => {
    latest = candidates;
  });
  return null;
}

async function render(patch: Partial<State> = {}) {
  state = { ...state, ...patch };
  await act(() => root.render(<Probe value={state} />));
}

beforeEach(async () => {
  vi.useFakeTimers();
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  hidden = false;
  Object.defineProperty(document, "hidden", { configurable: true, get: () => hidden });
  rpc.candidates.mockReset().mockResolvedValue({ _tag: "Success", value: [] });
  rpc.predict
    .mockReset()
    .mockResolvedValue({ _tag: "Success", value: { prompt: "A model response" } });
  rpc.cancel.mockReset().mockResolvedValue({ _tag: "Success", value: undefined });
  state = { draft: "", focused: true, mode: "local", messages: assistant, running: false };
  container = document.createElement("div");
  root = createRoot(container);
  await render();
});

afterEach(async () => {
  await act(() => root.unmount());
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("prompt prediction lifecycle", () => {
  it("keeps local mode free of model calls and recomputes the first typed word", async () => {
    rpc.candidates.mockResolvedValue({
      _tag: "Success",
      value: [{ text: "Run the tests", count: 2, lastSeen: 1 }],
    });
    // A refresh is held back for the live refresh floor after the mount read.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(LIVE_REFRESH_MIN_INTERVAL_MS);
      window.dispatchEvent(new Event("focus"));
    });
    await render({ draft: "Run", messages: [{ role: "assistant", text: "The tests are ready." }] });
    expect(latest.some((candidate) => candidate.text === "Run the tests")).toBe(true);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(6_000);
    });
    expect(rpc.predict).not.toHaveBeenCalled();
  });

  it("debounces, cancels on edits and focus loss, and ignores late responses", async () => {
    let resolveFirst!: (value: unknown) => void;
    rpc.predict.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveFirst = resolve;
        }),
    );
    await render({ mode: "local-model" });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(399);
    });
    expect(rpc.predict).not.toHaveBeenCalled();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
    expect(rpc.predict).toHaveBeenCalledTimes(1);
    const firstId = rpc.predict.mock.calls[0]![0].input.sessionId;
    await render({ draft: "New" });
    expect(rpc.cancel).toHaveBeenCalledWith({
      environmentId: "environment",
      input: { sessionId: firstId },
    });
    await act(async () => {
      resolveFirst({ _tag: "Success", value: { prompt: "Stale response" } });
    });
    expect(latest.some((candidate) => candidate.text === "Stale response")).toBe(false);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(400);
    });
    const secondId = rpc.predict.mock.calls[1]![0].input.sessionId;
    expect(secondId).not.toBe(firstId);
    await render({ focused: false });
    expect(rpc.cancel).toHaveBeenCalledWith({
      environmentId: "environment",
      input: { sessionId: secondId },
    });
  });

  it("stops generation when hidden or running and does not retry a failed state", async () => {
    rpc.predict.mockResolvedValue({ _tag: "Failure" });
    await render({ mode: "local-model" });
    hidden = true;
    await act(() => document.dispatchEvent(new Event("visibilitychange")));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });
    expect(rpc.predict).not.toHaveBeenCalled();
    hidden = false;
    await act(() => document.dispatchEvent(new Event("visibilitychange")));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(400);
    });
    expect(rpc.predict).toHaveBeenCalledTimes(1);
    await render({ running: true });
    await render({ running: false });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_000);
    });
    expect(rpc.predict).toHaveBeenCalledTimes(1);
  });

  it("holds cloud requests at least five seconds apart", async () => {
    await render({ mode: "cloud" });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(400);
    });
    await render({ draft: "Different" });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(4_999);
    });
    expect(rpc.predict).toHaveBeenCalledTimes(1);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
    expect(rpc.predict).toHaveBeenCalledTimes(2);
  });
});

it("bounds transcript and selects only relevant own examples", () => {
  const messages: PromptPredictionMessage[] = [
    { role: "system", text: "secret" },
    ...Array.from({ length: 7 }, (_, index) => ({
      role: index % 2 ? ("assistant" as const) : ("user" as const),
      text: "x".repeat(3_100),
    })),
  ];
  expect(transcriptFor(messages)).toHaveLength(6);
  expect(transcriptFor(messages).every((message) => message.text.length === 3_000)).toBe(true);
  const own = [{ text: "Run the tests", count: 2, lastSeen: 1 }];
  expect(
    personalExamplesFor(
      own,
      [...own, { text: "Standard phrase", count: 0, lastSeen: 0, standard: true }],
      "Run",
    ),
  ).toEqual(["Run the tests"]);
});
