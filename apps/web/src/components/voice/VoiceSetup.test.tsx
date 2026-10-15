// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { EnvironmentId } from "@t3tools/contracts";
import { afterEach, beforeEach, expect, it, vi } from "vite-plus/test";

const mocks = vi.hoisted(() => ({ allowed: true, save: vi.fn(), ready: vi.fn(), read: vi.fn() }));
vi.mock("@effect/atom-react", () => ({ useAtomValue: () => mocks.allowed }));
vi.mock("../../state/server", () => ({
  serverEnvironment: { setVoiceKey: { permissionAtom: () => null } },
}));
vi.mock("../../state/use-atom-command", () => ({ useAtomCommand: () => mocks.save }));
vi.mock("../../browser/previewRuntime", () => ({ usePreviewAvailable: () => true }));
vi.mock("./GroqSetupBrowser", () => ({
  GroqSetupBrowser: ({ onCopiedKey }: { onCopiedKey: (text: string) => void }) => (
    <button onClick={() => onCopiedKey(`gsk_${"a".repeat(48)}`)}>Copy sample key</button>
  ),
}));
import { VoiceSetup } from "./VoiceSetup";
let root: Root;
let container: HTMLDivElement;
beforeEach(() => {
  vi.clearAllMocks();
  mocks.allowed = true;
  mocks.save.mockResolvedValue({ _tag: "Success", value: {} });
  mocks.read.mockResolvedValue("unrelated clipboard text");
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { readText: mocks.read },
  });
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
async function render() {
  await act(async () =>
    root.render(<VoiceSetup environmentId={EnvironmentId.make("test")} onReady={mocks.ready} />),
  );
}
async function click(text: string) {
  const button = [...container.querySelectorAll("button")].find(
    (button) => button.textContent === text,
  );
  expect(button).toBeDefined();
  await act(async () => button!.click());
}
it("opens the embedded browser only on request and accepts its copied key", async () => {
  await render();
  expect(container.textContent).not.toContain("Copy sample key");
  await click("Open Groq");
  await click("Copy sample key");
  expect(mocks.save).toHaveBeenCalledTimes(1);
  expect(mocks.ready).toHaveBeenCalledTimes(1);
});
it("stops reading the clipboard after cancellation", async () => {
  await render();
  window.dispatchEvent(new Event("focus"));
  expect(mocks.read).not.toHaveBeenCalled();
  await click("Open Groq");
  await act(async () => window.dispatchEvent(new Event("focus")));
  expect(mocks.read).toHaveBeenCalledTimes(1);
  await click("Close Groq");
  window.dispatchEvent(new Event("focus"));
  expect(mocks.read).toHaveBeenCalledTimes(1);
});
it("ignores a clipboard result that arrives after setup closes", async () => {
  let resolve!: (text: string) => void;
  mocks.read.mockReturnValue(
    new Promise<string>((done) => {
      resolve = done;
    }),
  );
  await render();
  await click("Open Groq");
  await act(async () => window.dispatchEvent(new Event("focus")));
  await click("Close Groq");
  await act(async () => resolve(`gsk_${"a".repeat(48)}`));
  expect(mocks.save).not.toHaveBeenCalled();
});
it("shows manual paste recovery when clipboard access is denied", async () => {
  mocks.read.mockRejectedValue(new DOMException("Denied", "NotAllowedError"));
  await render();
  await click("Open Groq");
  await act(async () => window.dispatchEvent(new Event("focus")));
  expect(container.textContent).toContain("Clipboard access is blocked");
  expect(container.querySelector('input[type="password"]')).not.toBeNull();
});
it("closes capture when settings permission is revoked", async () => {
  await render();
  await click("Open Groq");
  mocks.allowed = false;
  await render();
  expect(container.textContent).not.toContain("Copy sample key");
  window.dispatchEvent(new Event("focus"));
  expect(mocks.read).not.toHaveBeenCalled();
});
it("releases all capture timers after ten open and close cycles", async () => {
  vi.useFakeTimers();
  await render();
  const before = vi.getTimerCount();
  for (let cycle = 0; cycle < 10; cycle++) {
    await click("Open Groq");
    await click("Close Groq");
  }
  // Let the shared button's focus feedback settle; capture timers must stay removed.
  await act(async () => vi.advanceTimersByTime(1000));
  expect(vi.getTimerCount()).toBe(before);
  expect(mocks.save).not.toHaveBeenCalled();
});
it("expires clipboard capture after ten minutes", async () => {
  vi.useFakeTimers();
  await render();
  await click("Open Groq");
  await act(async () => vi.advanceTimersByTime(10 * 60 * 1000));
  expect(container.textContent).not.toContain("Copy sample key");
  expect(vi.getTimerCount()).toBe(0);
});
