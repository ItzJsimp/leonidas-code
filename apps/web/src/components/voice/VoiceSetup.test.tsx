// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { EnvironmentId } from "@t3tools/contracts";
import { afterEach, beforeEach, expect, it, vi } from "vite-plus/test";

const mocks = vi.hoisted(() => ({
  allowed: true,
  save: vi.fn(),
  ready: vi.fn(),
  read: vi.fn(),
  open: vi.fn(),
}));
vi.mock("@effect/atom-react", () => ({ useAtomValue: () => mocks.allowed }));
vi.mock("../../state/server", () => ({
  serverEnvironment: { setVoiceKey: { permissionAtom: () => null } },
}));
vi.mock("../../state/use-atom-command", () => ({ useAtomCommand: () => mocks.save }));
vi.mock("../../localApi", () => ({
  ensureLocalApi: () => ({ shell: { openExternal: mocks.open } }),
}));
import { VoiceSetup } from "./VoiceSetup";
let root: Root;
let container: HTMLDivElement;
beforeEach(() => {
  vi.clearAllMocks();
  mocks.allowed = true;
  mocks.save.mockResolvedValue({ _tag: "Success", value: {} });
  mocks.read.mockResolvedValue("unrelated clipboard text");
  mocks.open.mockResolvedValue(undefined);
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
const KEY = `gsk_${"a".repeat(48)}`;
const field = () => container.querySelector('input[type="password"]') as HTMLInputElement;
it("opens Groq keys in the default browser and starts clipboard capture", async () => {
  await render();
  await click("Open Groq");
  expect(mocks.open).toHaveBeenCalledWith("https://console.groq.com/keys");
  expect(container.textContent).toContain("Leonidas");
  expect(container.textContent).toContain("No expiration");
});
it("fills the field from a copied key without saving it", async () => {
  mocks.read.mockResolvedValue(KEY);
  await render();
  await click("Open Groq");
  await act(async () => window.dispatchEvent(new Event("focus")));
  expect(field().value).toBe(KEY);
  expect(mocks.save).not.toHaveBeenCalled();
  expect(mocks.ready).not.toHaveBeenCalled();
});
it("saves on Enable voice, shows success, and closes only on Done", async () => {
  await render();
  const input = field();
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, KEY);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await click("Enable voice");
  expect(mocks.save).toHaveBeenCalledTimes(1);
  expect(container.textContent).toContain("Voice is on");
  expect(mocks.ready).not.toHaveBeenCalled();
  await click("Done");
  expect(mocks.ready).toHaveBeenCalledTimes(1);
});
it("shows manual paste recovery when clipboard access is denied", async () => {
  mocks.read.mockRejectedValue(new DOMException("Denied", "NotAllowedError"));
  await render();
  await click("Open Groq");
  await act(async () => window.dispatchEvent(new Event("focus")));
  expect(container.textContent).toContain("Clipboard access is blocked");
});
it("stops reading the clipboard when settings permission is revoked", async () => {
  await render();
  await click("Open Groq");
  mocks.allowed = false;
  await render();
  window.dispatchEvent(new Event("focus"));
  expect(mocks.read).not.toHaveBeenCalled();
});
it("expires clipboard capture after ten minutes", async () => {
  vi.useFakeTimers();
  await render();
  await click("Open Groq");
  await act(async () => vi.advanceTimersByTime(10 * 60 * 1000));
  expect(vi.getTimerCount()).toBe(0);
});
