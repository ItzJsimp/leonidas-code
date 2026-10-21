// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { EnvironmentId } from "@t3tools/contracts";
import { afterEach, beforeEach, expect, it, vi } from "vite-plus/test";

import {
  SETUP_STATE_STORAGE_KEY,
  openSetupItems,
  type SetupState,
} from "../../../onboarding/setupState.logic";

const primary = vi.hoisted(() => ({
  current: { environmentId: "local" } as { environmentId: string } | null,
}));
const navigate = vi.fn(async (_options: unknown) => undefined);
const completeOnboarding = vi.fn(async () => undefined);
const write = vi.fn(async (_folder: string, _files: readonly { relativePath: string }[]) => ({
  ok: true as const,
  created: [],
  skipped: [],
}));

vi.mock("@tanstack/react-router", () => ({ useNavigate: () => navigate }));
vi.mock("@effect/atom-react", () => ({ useAtomValue: () => [] }));
vi.mock("../../../onboarding/firstRun", () => ({
  useCompleteOnboarding: () => completeOnboarding,
}));
vi.mock("../../../onboarding/useAiosFileWriter", () => ({
  useAiosFileWriter: () => ({ canWrite: true, write }),
}));
vi.mock("../../../state/environments", () => ({
  usePrimaryEnvironment: () => primary.current,
}));
vi.mock("../../../state/server", () => ({ primaryServerAvailableEditorsAtom: {} }));
vi.mock("../WelcomeWizard", () => ({ WelcomeWizard: () => <p>old wizard</p> }));
vi.mock("../AgentsStep", () => ({
  AgentsStep: (props: { onContinue: (ready: boolean) => void }) => (
    <button type="button" onClick={() => props.onContinue(false)}>
      Continue without an AI
    </button>
  ),
}));

const { SetupFlow } = await import("./SetupFlow");

let root: Root;
let container: HTMLDivElement;

beforeEach(() => {
  localStorage.clear();
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

function button(name: string): HTMLButtonElement {
  const found = [...document.body.querySelectorAll("button")].find(
    (node) => node.textContent?.trim() === name,
  );
  if (!found) throw new Error(`no button ${name}`);
  return found;
}

function storedState(): SetupState {
  return JSON.parse(localStorage.getItem(SETUP_STATE_STORAGE_KEY) ?? "null") as SetupState;
}

it("enters the app with every optional step skipped, and lists each skip", async () => {
  await act(async () => root.render(<SetupFlow localAvailable onDone={() => {}} />));
  await act(async () => button("Continue").click());
  await act(async () => button("Continue without an AI").click());
  await act(async () => button("Skip for now").click());

  expect(completeOnboarding).toHaveBeenCalledOnce();
  expect(navigate).toHaveBeenCalledWith({ to: "/command-center", replace: true });
  // The identity file is still written, so the AI knows its name.
  expect(write.mock.calls[0]?.[1].map((file) => file.relativePath)).toContain("CLAUDE.md");

  const state = storedState();
  expect(state.startedAt).not.toBeNull();
  const open = openSetupItems(state).map((item) => item.id);
  expect(open).not.toContain("basics");
  for (const id of ["account", "questions", "interview", "import", "voice", "keys", "skills"]) {
    expect(open).toContain(id);
  }
});

it("keeps the old wizard for setups without this computer", async () => {
  await act(async () => root.render(<SetupFlow localAvailable={false} onDone={() => {}} />));
  expect(document.body.textContent).toContain("old wizard");
});

it("waits for this computer instead of flashing the old wizard", async () => {
  primary.current = null;
  await act(async () => root.render(<SetupFlow localAvailable onDone={() => {}} />));
  expect(document.body.textContent).not.toContain("old wizard");
  expect(document.body.querySelector('[role="status"]')).not.toBeNull();
  primary.current = { environmentId: EnvironmentId.make("local") };
});
