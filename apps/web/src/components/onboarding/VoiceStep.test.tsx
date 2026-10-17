// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { EnvironmentId } from "@t3tools/contracts";
import { afterEach, beforeEach, expect, it, vi } from "vite-plus/test";

const mocks = vi.hoisted(() => ({
  configured: false,
  pending: false,
  failed: false,
  refresh: vi.fn(),
}));
vi.mock("../../state/server", () => ({
  serverEnvironment: { voiceStatus: (target: unknown) => target },
}));
vi.mock("../../state/query", () => ({
  useEnvironmentQuery: () => ({
    data: mocks.failed ? null : { keyConfigured: mocks.configured },
    isPending: mocks.pending,
    error: mocks.failed ? "Unavailable" : null,
    refresh: mocks.refresh,
  }),
}));
vi.mock("../voice/VoiceSetup", () => ({
  VoiceSetup: ({ onReady }: { onReady: () => void }) => <button onClick={onReady}>Save key</button>,
}));
vi.mock("../voice/ComposerVoiceButton", () => ({
  ComposerVoiceButton: ({
    disabled,
    onText,
  }: {
    disabled: boolean;
    onText: (text: string) => boolean;
  }) => (
    <button disabled={disabled} onClick={() => onText("Test words")}>
      Test microphone
    </button>
  ),
}));
import { VoiceStep } from "./VoiceStep";
let root: Root;
let container: HTMLDivElement;
beforeEach(() => {
  mocks.configured = mocks.pending = mocks.failed = false;
  vi.clearAllMocks();
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
async function render(environmentId = "test") {
  await act(async () =>
    root.render(
      <VoiceStep
        environmentId={EnvironmentId.make(environmentId)}
        onBack={() => {}}
        onContinue={() => {}}
      />,
    ),
  );
}
function button(text: string) {
  return [...container.querySelectorAll("button")].find((node) => node.textContent === text)!;
}
it("keeps the spoken test disabled until key setup succeeds", async () => {
  await render();
  expect(button("Test microphone").disabled).toBe(true);
  await act(async () => button("Save key").click());
  expect(button("Test microphone").disabled).toBe(false);
  await act(async () => button("Test microphone").click());
  expect(container.textContent).toContain("Test words");
  expect(button("Continue").disabled).toBe(false);
});
it("recognizes a saved key without asking the user to set it up again", async () => {
  mocks.configured = true;
  await render();
  expect(button("Test microphone").disabled).toBe(false);
  expect(container.textContent).not.toContain("Save key");
});
it("keeps the test disabled when saved-key status is unavailable", async () => {
  mocks.failed = true;
  await render();
  expect(button("Test microphone").disabled).toBe(true);
  expect(container.textContent).toContain("Check voice status");
});
it("does not carry key readiness or a test transcript to another computer", async () => {
  await render();
  await act(async () => button("Save key").click());
  await act(async () => button("Test microphone").click());
  await render("other");
  expect(button("Test microphone").disabled).toBe(true);
  expect(button("Continue").disabled).toBe(true);
  expect(container.textContent).not.toContain("Test words");
});
