import { assert, describe, it } from "@effect/vitest";

import { MemoryActionLog } from "./actionLog.ts";
import { applyActions, type ApplyDeps } from "./apply.ts";
import { FakeMailProvider } from "./fakeProvider.ts";
import { ProviderError } from "./provider.ts";
import { msg } from "./testkit.ts";
import { planUndo, runUndo } from "./undo.ts";
import type { Action } from "./types.ts";

const setup = () => {
  const provider = new FakeMailProvider();
  const log = new MemoryActionLog();
  let n = 0;
  const deps: ApplyDeps = {
    provider,
    log,
    inbox: "sg",
    now: () => "2026-10-21T12:00:00.000Z",
    newId: () => `e${++n}`,
  };
  return { provider, log, deps };
};

const inboxMsg = (over: Parameters<typeof msg>[0] = {}) =>
  msg({ labels: ["INBOX", "STARRED"], fromAddress: "sam@example.test", ...over });

const plan3: Action[] = [
  { type: "label", labels: ["SG/Pitch"] },
  { type: "archive" },
  { type: "draft", subject: "Re: Hello", body: "Thanks Sam" },
];

describe("undo", () => {
  it("restores labels and INBOX and removes an unedited draft", async () => {
    const { provider, log, deps } = setup();
    const m = inboxMsg();
    provider.seed([m]);
    await applyActions(deps, m, plan3);
    const steps = planUndo(await log.readAll(), { messageId: "m1" });
    assert.equal(steps.length, 3);
    const results = await runUndo(deps, steps);
    assert.deepEqual(
      results.map((r) => r.outcome),
      ["undone", "undone", "undone"],
    );
    assert.sameMembers([...(await provider.getMessage("m1")).labels], ["INBOX", "STARRED"]);
    const draftEntry = (await log.readAll()).find(
      (e) => e.status === "applied" && e.inverse?.type === "deleteDraft",
    )!;
    assert.isNull(await provider.getDraft((draftEntry.inverse as { draftId: string }).draftId));
  });

  it("undoes in reverse order", async () => {
    const { provider, log, deps } = setup();
    const m = inboxMsg();
    provider.seed([m]);
    await applyActions(deps, m, plan3);
    const steps = planUndo(await log.readAll(), {});
    assert.deepEqual(
      steps.map((s) => s.inverse.type),
      ["deleteDraft", "labels", "labels"],
    );
  });

  it("leaves an edited draft alone and says why", async () => {
    const { provider, log, deps } = setup();
    const m = inboxMsg();
    provider.seed([m]);
    await applyActions(deps, m, plan3);
    const applied = (await log.readAll()).find((e) => e.inverse?.type === "deleteDraft")!;
    const draftId = (applied.inverse as { draftId: string }).draftId;
    provider.editDraft(draftId, "Gersi rewrote this");
    const results = await runUndo(deps, planUndo(await log.readAll(), {}));
    assert.equal(results[0]?.outcome, "skipped");
    assert.equal((await provider.getDraft(draftId))?.body, "Gersi rewrote this");
    const last = (await log.readAll()).find((e) => e.status === "skipped")!;
    assert.equal(last.note, "edited");
  });

  it("does nothing the second time", async () => {
    const { provider, log, deps } = setup();
    const m = inboxMsg();
    provider.seed([m]);
    await applyActions(deps, m, plan3);
    await runUndo(deps, planUndo(await log.readAll(), {}));
    assert.deepEqual(planUndo(await log.readAll(), {}), []);
  });

  it("does not retry a draft that was left because it was edited", async () => {
    const { provider, log, deps } = setup();
    const m = inboxMsg();
    provider.seed([m]);
    await applyActions(deps, m, [{ type: "draft", subject: "Re: Hello", body: "x" }]);
    const applied = (await log.readAll()).find((e) => e.inverse?.type === "deleteDraft")!;
    provider.editDraft((applied.inverse as { draftId: string }).draftId, "mine");
    await runUndo(deps, planUndo(await log.readAll(), {}));
    assert.deepEqual(planUndo(await log.readAll(), {}), []);
  });

  it("only undoes the selected message", async () => {
    const { provider, log, deps } = setup();
    const a = inboxMsg({ id: "a", threadId: "ta" });
    const b = inboxMsg({ id: "b", threadId: "tb" });
    provider.seed([a, b]);
    await applyActions(deps, a, [{ type: "archive" }]);
    await applyActions(deps, b, [{ type: "archive" }]);
    await runUndo(deps, planUndo(await log.readAll(), { messageId: "a" }));
    assert.include((await provider.getMessage("a")).labels, "INBOX");
    assert.notInclude((await provider.getMessage("b")).labels, "INBOX");
  });

  it("does not undo a failed or skipped action", async () => {
    const { provider, log, deps } = setup();
    const m = inboxMsg();
    provider.seed([m]);
    provider.failNext.set("archive", new ProviderError("transient", "boom"));
    await applyActions(deps, m, [{ type: "archive" }]);
    assert.deepEqual(planUndo(await log.readAll(), {}), []);
  });

  it("records a failed undo call and keeps going", async () => {
    const { provider, log, deps } = setup();
    const m = inboxMsg();
    provider.seed([m]);
    await applyActions(deps, m, plan3);
    provider.failNext.set("getDraft", new ProviderError("rate_limited", "slow"));
    const results = await runUndo(deps, planUndo(await log.readAll(), {}));
    assert.equal(results[0]?.outcome, "failed");
    assert.equal(results[1]?.outcome, "undone");
    assert.equal(planUndo(await log.readAll(), {}).length, 1);
  });
});
