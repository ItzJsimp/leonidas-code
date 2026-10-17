// @vitest-environment jsdom
import { act, StrictMode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { EnvironmentId, type ScopedThreadRef } from "@t3tools/contracts";
import { afterEach, beforeEach, expect, it, vi } from "vite-plus/test";

const mocks = vi.hoisted(() => ({ open: vi.fn(), close: vi.fn() }));
vi.mock("../../state/preview", () => ({ previewEnvironment: { open: "open", close: "close" } }));
vi.mock("../../state/use-atom-command", () => ({
  useAtomCommand: (command: string) => (command === "open" ? mocks.open : mocks.close),
}));
vi.mock("../preview/openPreviewSession", () => ({ openPreviewSession: mocks.open }));
vi.mock("../preview/PreviewView", () => ({ PreviewView: () => <p>Groq page</p> }));
import { GroqSetupBrowser } from "./GroqSetupBrowser";
let root: Root;
let container: HTMLDivElement;
beforeEach(() => {
  vi.clearAllMocks();
  mocks.close.mockResolvedValue({ _tag: "Success" });
  mocks.open.mockResolvedValue({ _tag: "Success", value: {} });
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});
it("closes all setup tabs when a delayed open completes after cancellation", async () => {
  let resolve!: (result: { _tag: string }) => void;
  mocks.open.mockReturnValue(
    new Promise((done) => {
      resolve = done;
    }),
  );
  await act(async () =>
    root.render(
      <GroqSetupBrowser environmentId={EnvironmentId.make("test")} onCopiedKey={() => {}} />,
    ),
  );
  const ref = mocks.open.mock.calls[0]![0].threadRef as ScopedThreadRef;
  await act(async () => root.render(null));
  expect(mocks.close).not.toHaveBeenCalled();
  await act(async () => resolve({ _tag: "Success" }));
  expect(mocks.close).toHaveBeenCalledWith({
    environmentId: ref.environmentId,
    input: { threadId: ref.threadId },
  });
});
it("gives Strict Mode generations separate tabs and closes both", async () => {
  await act(async () =>
    root.render(
      <StrictMode>
        <GroqSetupBrowser environmentId={EnvironmentId.make("test")} onCopiedKey={() => {}} />
      </StrictMode>,
    ),
  );
  expect(mocks.open).toHaveBeenCalledTimes(2);
  const refs = mocks.open.mock.calls.map(([input]) => input.threadRef as ScopedThreadRef);
  expect(refs[0]!.threadId).not.toBe(refs[1]!.threadId);
  await act(async () => root.render(null));
  expect(mocks.close.mock.calls.map(([input]) => input.input.threadId).sort()).toEqual(
    refs.map((ref) => ref.threadId).sort(),
  );
});
it("gives a manual paste recovery when browser opening fails", async () => {
  mocks.open.mockResolvedValue({ _tag: "Failure" });
  await act(async () =>
    root.render(
      <GroqSetupBrowser environmentId={EnvironmentId.make("test")} onCopiedKey={() => {}} />,
    ),
  );
  expect(container.querySelector('[role="alert"]')?.textContent).toContain("paste the key below");
});
