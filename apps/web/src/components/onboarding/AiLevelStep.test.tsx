// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { EnvironmentId } from "@t3tools/contracts";
import { afterEach, beforeEach, expect, it, vi } from "vite-plus/test";
import { guidanceProfileKey, GuidanceProfileSchema } from "../../onboarding/guidance.logic";
import { DEFAULT_AIOS_FOLDER } from "../../onboarding/leonidasSetup.logic";
import * as Schema from "effect/Schema";
import { AiLevelStep } from "./AiLevelStep";
const decodeProfile = Schema.decodeUnknownSync(Schema.fromJsonString(GuidanceProfileSchema));

let root: Root;
let container: HTMLDivElement;
const next = vi.fn();
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
async function render(environmentId = "test") {
  await act(async () =>
    root.render(
      <AiLevelStep
        environmentId={EnvironmentId.make(environmentId)}
        onBack={() => {}}
        onContinue={next}
      />,
    ),
  );
}
it("saves the default level before continuing without starting the coach early", async () => {
  await render();
  await act(async () =>
    [...container.querySelectorAll("button")]
      .find((node) => node.textContent === "Save AI level")!
      .click(),
  );
  const stored = localStorage.getItem(guidanceProfileKey("test", DEFAULT_AIOS_FOLDER));
  const profile = decodeProfile(stored);
  expect(profile.level).toBe("new");
  expect(profile.active).toBe(false);
  expect(next).toHaveBeenCalledTimes(1);
});
it("keeps the selected level after remount", async () => {
  await render();
  await act(async () =>
    (container.querySelector('[role="radio"][value="builder"]') ??
      [...container.querySelectorAll('[role="radio"]')][3])!.dispatchEvent(
      new MouseEvent("click", { bubbles: true }),
    ),
  );
  await act(async () => root.render(null));
  await render();
  expect(
    container.querySelector('[role="radio"][aria-checked="true"]')?.closest("label")?.textContent,
  ).toContain("Builder");
  const stored = localStorage.getItem(guidanceProfileKey("test", DEFAULT_AIOS_FOLDER));
  expect(JSON.parse(stored!).level).toBe("builder");
});
it("does not reuse a level from another environment", async () => {
  await render();
  await act(async () =>
    [...container.querySelectorAll("button")]
      .find((node) => node.textContent === "Save AI level")!
      .click(),
  );
  await render("other");
  expect(localStorage.getItem(guidanceProfileKey("other", DEFAULT_AIOS_FOLDER))).toBeNull();
});
