// @vitest-environment jsdom
import type { LayaUsage } from "@t3tools/contracts";
import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterAll, afterEach, expect, it, vi } from "vite-plus/test";

import { LayaMonitorCard } from "./LayaMonitorCard";

const query = vi.hoisted(() => ({ data: null as LayaUsage | null, error: null as string | null }));
vi.mock("~/state/environments", () => ({ usePrimaryEnvironmentId: () => "test" }));
vi.mock("~/state/query", () => ({ useEnvironmentQuery: () => query }));
vi.mock("~/state/taskBoard", () => ({ layaUsageQuery: () => null }));

const ready: LayaUsage = {
  status: "ready",
  modelPresent: true,
  packPresent: true,
  engineStatus: "ready",
  modelHash: "68002e72",
  probeMs: 30.35,
  jevState: "off",
  gameMode: false,
  tiers: { rules: 101, model: 12, jev: 3 },
  total: 116,
  days: [{ date: "2026-10-19", count: 116 }],
  jobs: [{ job: "screen", count: 116, blocked: 0, asked: 0, flagged: 2 }],
};
const roots: ReturnType<typeof createRoot>[] = [];
vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
afterAll(() => vi.unstubAllGlobals());
afterEach(async () => {
  for (const root of roots.splice(0)) await act(async () => root.unmount());
  document.body.replaceChildren();
  query.data = null;
  query.error = null;
});

async function renderCard() {
  const router = createRouter({
    routeTree: createRootRoute({
      component: LayaMonitorCard,
    }),
    history: createMemoryHistory({ initialEntries: ["/"] }),
  });
  await router.load();
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  roots.push(root);
  await act(async () => root.render(<RouterProvider router={router} />));
  return container;
}

it("shows engine health and tier counts alongside recorded checks", async () => {
  query.data = ready;
  const card = await renderCard();
  expect(card.textContent).toContain("EngineReady");
  expect(card.textContent).toContain("Model68002e72");
  expect(card.textContent).toContain("Last probe30.35 ms");
  expect(card.textContent).toContain("Jev backupOff");
  expect(card.textContent).toContain("Game ModeOff");
  expect(card.textContent).toContain("Rules101");
  expect(card.textContent).toContain("Model12");
  expect(card.textContent).toContain("Jev3");
  expect(card.textContent).toContain("2 warnings");
});

it.each(["paused", "error", "missing-runtime", "missing-model", "missing-pack"] as const)(
  "explains %s health without hiding prior usage",
  async (engineStatus) => {
    query.data = { ...ready, status: "missing", engineStatus, jevState: "paused" };
    const card = await renderCard();
    expect(card.textContent).toContain("116");
    expect(card.textContent).toContain("Jev backupPaused");
    expect(card.querySelector("a")?.getAttribute("href")).toBe("/settings/general");
    card.querySelector("a")?.focus();
    expect(document.activeElement).toBe(card.querySelector("a"));
    expect(card.textContent).not.toContain("Laya is not installed on this computer.");
  },
);

it("shows health before the first check and keeps loading and failure messages readable", async () => {
  query.data = { ...ready, total: 0, jobs: [], days: [], probeMs: null, modelHash: null };
  const empty = await renderCard();
  expect(empty.textContent).toContain("No checks have run yet.");
  expect(empty.textContent).toContain("Not measured");
  expect(empty.textContent).toContain("Jev backupOff");
  query.data = null;
  expect((await renderCard()).querySelector('[role="status"]')?.textContent).toBe("Loading...");
  query.error = "raw private error";
  const failed = await renderCard();
  expect(failed.textContent).toContain("Try again later.");
  expect(failed.textContent).not.toContain("raw private error");
});
