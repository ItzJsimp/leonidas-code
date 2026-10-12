import test from "node:test";
import assert from "node:assert/strict";

import { MockJevClient } from "./typesafeClient.js";
import { decide } from "./decider.js";
import { chunkNotes, pickNotes } from "./notesSelector.js";
import { routeStep } from "./workerRouter.js";
import { recoverFailure, extractMissingPackage } from "./recoveryEngine.js";
import { pickTests, runStagedChecks } from "./focusedChecks.js";
import { calculateSessionEconomics } from "./costCalculator.js";
import { AgentHarness } from "./agentHarness.js";

test("Decider applies confidence threshold gating", async () => {
  const client = new MockJevClient();
  const d = await decide(
    client,
    "STEP: rename func",
    "What kind of work is this step?",
    ["rename_or_move", "new_logic"],
    0.8,
  );
  assert.equal(d.answer, "rename_or_move");
  assert.equal(d.confident, true);
});

test("NotesSelector filters unneeded notes and keeps non-negotiables", async () => {
  const client = new MockJevClient();
  const notes = [
    { source: "auth.md", text: "Rate limit token bucket authentication specs" },
    { source: "billing.md", text: "Monthly Stripe billing cycle" },
  ];
  const always = [{ source: "security.md", text: "Never expose secret keys" }];

  const res = await pickNotes("Add rate limit middleware", notes, client, always, 2, 0.55);
  assert.ok(res.keptNotes.some((n) => n.source === "security.md"));
  assert.ok(res.keptNotes.some((n) => n.source === "auth.md"));
  assert.ok(res.tokensSaved >= 0);
});

test("WorkerRouter sends mechanical tasks to fast worker and complex tasks to opus", async () => {
  const client = new MockJevClient();
  const rFast = await routeStep("rename variable id to userId", "", client);
  assert.equal(rFast.tier, "fast");

  const rOpus = await routeStep("design consensus protocol", "", client);
  assert.equal(rOpus.tier, "opus");
});

test("RecoveryEngine parses missing package and suggests install remediation", async () => {
  const client = new MockJevClient();
  const err = "Cannot find module 'bottleneck'";
  const plan = await recoverFailure("npm test", "npm test", err, 1, client);
  assert.equal(plan.action, "retry_after_install");
  assert.match(plan.remediationCmd || "", /npm install bottleneck/);
  assert.equal(plan.requiresHuman, false);

  // Attempt cap
  const capped = await recoverFailure("npm test", "npm test", err, 3, client, 3);
  assert.equal(capped.action, "stop_and_report");
  assert.equal(capped.requiresHuman, true);
});

test("SessionEconomics matches the 68.8% savings from the paper", () => {
  const eco = calculateSessionEconomics();
  assert.equal(eco.baselineCost, 6.42);
  assert.equal(eco.routerCost, 2.0);
  assert.equal(eco.savedPercent, 68.8);
});

test("AgentHarness runs end-to-end trace smoothly", async () => {
  const harness = new AgentHarness({
    notes: [{ source: "api.md", text: "Rate limit middleware with redis" }],
    alwaysNotes: [{ source: "sec.md", text: "Security rules" }],
    testFiles: ["test/auth.test.ts", "test/other.test.ts"],
  });

  const trace = await harness.runStep("add a per IP rate limit to POST /signup", [
    { tool: "npm test", command: "npm test", error: "Cannot find module 'bottleneck'", attempt: 1 },
  ]);

  assert.equal(trace.stepNumber, 1);
  assert.equal(trace.workerUsed, "Opus-5.5");
  assert.equal(trace.recoveryPlans.length, 1);
  assert.equal(trace.recoveryPlans[0].action, "retry_after_install");
  assert.equal(trace.checksResult?.passed, true);
});
