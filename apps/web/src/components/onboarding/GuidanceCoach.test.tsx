// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { EnvironmentId } from "@t3tools/contracts";
import { beforeEach, afterEach, expect, it, vi } from "vite-plus/test";
import { newGuidanceProfile, type GuidanceProfile } from "../../onboarding/guidance.logic";
import { emitGuidanceAction } from "../../onboarding/guidanceActions";

const mocks = vi.hoisted(() => ({
  profile: null as GuidanceProfile | null,
  save: vi.fn(),
  start: vi.fn(),
  project: vi.fn(),
  navigate: vi.fn(),
}));
vi.mock("@tanstack/react-router", () => ({
  useParams: () => ({ environmentId: "test" }),
  useLocation: () => "/test/thread",
  useNavigate: () => mocks.navigate,
}));
vi.mock("../../state/environments", () => ({ usePrimaryEnvironmentId: () => "test" }));
vi.mock("../../onboarding/aiLevelSync", () => ({ useAiLevelServerSync: () => {} }));
vi.mock("../../onboarding/useGuidanceProfile", () => ({
  useGuidanceProfile: () => [mocks.profile, mocks.save],
}));
vi.mock("../../hooks/useLocalStorage", () => ({ useLocalStorage: () => ["~/Test AIOS", vi.fn()] }));
vi.mock("../../onboarding/useOnboardingChat", () => ({
  useOnboardingChat: () => ({
    canOperate: true,
    ensureFolderProject: mocks.project,
    startChat: mocks.start,
    providerName: "Test AI",
    modelName: "test-model",
  }),
}));
vi.mock("../ui/dialog", () => ({
  Dialog: ({ open, children }: { open: boolean; children: React.ReactNode }) =>
    open ? <div>{children}</div> : null,
  DialogPopup: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <h1>{children}</h1>,
  DialogDescription: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
  DialogPanel: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
import { GuidanceCoach } from "./GuidanceCoach";
import { openGuide } from "./guideEvents";
let root: Root;
let container: HTMLDivElement;
beforeEach(() => {
  vi.clearAllMocks();
  mocks.profile = newGuidanceProfile("new", new Date());
  mocks.save.mockImplementation(
    (update: GuidanceProfile | ((current: GuidanceProfile) => GuidanceProfile)) => {
      mocks.profile = typeof update === "function" ? update(mocks.profile!) : update;
    },
  );
  mocks.project.mockResolvedValue({ ok: true, projectId: "project" });
  mocks.start.mockResolvedValue({ ok: true, threadId: "explanation" });
  mocks.navigate.mockResolvedValue(undefined);
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
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
  await act(async () => root.render(<GuidanceCoach />));
}
async function click(text: string) {
  const button = [...container.querySelectorAll("button")].find(
    (node) => node.textContent === text,
  );
  expect(button).toBeDefined();
  await act(async () => button!.click());
}
it("runs no AI explanation until the user confirms the named model", async () => {
  await render();
  await act(async () => openGuide());
  await click("Explain with AI");
  expect(container.textContent).toContain("test-model");
  expect(mocks.start).not.toHaveBeenCalled();
  await click("Start AI explanation");
  expect(mocks.start).toHaveBeenCalledTimes(1);
  expect(mocks.start).toHaveBeenCalledWith(
    expect.objectContaining({ runtimeMode: "approval-required", interactionMode: "plan" }),
  );
  expect(mocks.navigate).toHaveBeenCalledTimes(1);
});
it("counts actions only for the selected environment", async () => {
  await render();
  await act(async () => emitGuidanceAction(EnvironmentId.make("other"), "prompt_sent"));
  expect(mocks.save).not.toHaveBeenCalled();
  await act(async () => emitGuidanceAction(EnvironmentId.make("test"), "prompt_sent"));
  expect(mocks.profile!.counts.prompt_sent).toBe(1);
});
it("removes its clock timer and action listener when unmounted", async () => {
  vi.useFakeTimers();
  await render();
  expect(vi.getTimerCount()).toBeGreaterThan(0);
  await act(async () => root.render(null));
  expect(vi.getTimerCount()).toBe(0);
  mocks.save.mockClear();
  emitGuidanceAction(EnvironmentId.make("test"), "prompt_sent");
  expect(mocks.save).not.toHaveBeenCalled();
  vi.useRealTimers();
});
it("does not start an explanation if its profile closes during preparation", async () => {
  let resolve!: (value: { ok: boolean; projectId: string }) => void;
  mocks.project.mockReturnValue(
    new Promise((done) => {
      resolve = done;
    }),
  );
  await render();
  await act(async () => openGuide());
  await click("Explain with AI");
  await click("Start AI explanation");
  await act(async () => root.render(null));
  await act(async () => resolve({ ok: true, projectId: "project" }));
  expect(mocks.start).not.toHaveBeenCalled();
  expect(mocks.navigate).not.toHaveBeenCalled();
});
