// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { EnvironmentId } from "@t3tools/contracts";
import { afterEach, beforeEach, expect, it, vi } from "vite-plus/test";

const mocks = vi.hoisted(() => ({ speak: "Sam" }));
vi.mock("~/state/environments", () => ({ usePrimaryEnvironmentId: () => "env-1" }));
vi.mock("../voice/ComposerVoiceButton", () => ({
  ComposerVoiceButton: ({ onText }: { onText: (text: string) => boolean }) => (
    <button type="button" aria-label="mic" onClick={() => onText(mocks.speak)} />
  ),
}));
vi.mock("../../onboarding/useOnboardingChat", () => ({
  useOnboardingChat: () => ({ canOperate: true, ensureFolderProject: vi.fn() }),
}));
vi.mock("../../onboarding/useFolderInspection", () => ({ useFolderInspection: () => vi.fn() }));
vi.mock("~/state/session", () => ({ useEnvironmentScope: () => true }));
vi.mock("~/state/use-atom-command", () => ({ useAtomCommand: () => vi.fn() }));
vi.mock("~/state/projects", () => ({ projectEnvironment: { writeFile: {} } }));
import { AiosInterviewForm } from "./AiosInterviewForm";

let root: Root;
let container: HTMLDivElement;
beforeEach(() => {
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

it("gives every free-text interview question a mic, and a spoken answer lands in the field", async () => {
  await act(async () =>
    root.render(
      <AiosInterviewForm
        environmentId={EnvironmentId.make("env-1")}
        folder="~/x"
        onDone={vi.fn()}
      />,
    ),
  );
  const fields = container.querySelectorAll("textarea");
  const mics = container.querySelectorAll<HTMLButtonElement>("[aria-label=mic]");
  expect(fields.length).toBe(2);
  expect(mics.length).toBe(2);
  await act(async () => mics[0]!.click());
  expect(fields[0]!.value).toBe("Sam");
});
