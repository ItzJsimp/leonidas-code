import { describe, expect, it } from "@effect/vitest";

import {
  classifyByRules,
  isSweepEligible,
  sweepTails,
  verdictFromScores,
  type LayaScorer,
  type ThreadTail,
} from "./threadSweep.ts";

const tail = (
  lastAssistant: string,
  endedOn: ThreadTail["endedOn"] = "assistant_text",
): ThreadTail => ({
  lastUser: "do the thing",
  lastAssistant,
  endedOn,
});

describe("classifyByRules", () => {
  it("marks a Session Complete reply done", () => {
    expect(
      classifyByRules(tail("Shipped.\n\n### 🏁 Session Complete\n- ✅ Objective achieved"))
        ?.verdict,
    ).toBe("done");
  });

  it("marks a handoff resume prompt done", () => {
    expect(
      classifyByRules(tail("Written.\n\n📋 Resume prompt\n```text\nResume from `x.md`\n```"))
        ?.verdict,
    ).toBe("done");
  });

  it("marks a short answer without a question done", () => {
    expect(classifyByRules(tail("OK"))?.verdict).toBe("done");
  });

  it("never marks a waiting reply done, even with a close-chat line", () => {
    const reply = "- **A)** Close this chat *(Wins when: you are done)*\n➡️ **Recommended: A**";
    expect(classifyByRules(tail(reply))?.verdict).toBe("unfinished");
  });

  it("marks a reply that ends with a question, a usage limit and a tool-call end unfinished", () => {
    expect(classifyByRules(tail("Do you want me to finish the branch?"))?.verdict).toBe(
      "unfinished",
    );
    expect(classifyByRules(tail("You've hit your session limit · resets 8:40am"))?.verdict).toBe(
      "unfinished",
    );
    expect(classifyByRules(tail("Checking the child processes.", "tool_use"))?.verdict).toBe(
      "unfinished",
    );
    expect(classifyByRules(tail("", "user"))?.verdict).toBe("unfinished");
  });

  it("abstains on an empty reply and returns null when no rule fires", () => {
    expect(classifyByRules(tail("  "))?.verdict).toBe("abstain");
    expect(
      classifyByRules(
        tail(
          "I changed three files and the tests pass, and this note is long enough to skip the short rule.",
        ),
      ),
    ).toBeNull();
  });
});

describe("verdictFromScores", () => {
  it("maps clear scores to a class and the middle band to abstain", () => {
    expect(verdictFromScores([0.9, 0.1]).verdict).toBe("done");
    expect(verdictFromScores([0.2, 0.1]).verdict).toBe("unfinished");
    expect(verdictFromScores([0.9, 0.8]).verdict).toBe("unfinished");
    expect(verdictFromScores([0.5, 0.5]).verdict).toBe("abstain");
    expect(verdictFromScores([0.9, 0.5]).verdict).toBe("abstain");
    expect(verdictFromScores([null, 0.1]).verdict).toBe("abstain");
  });
});

describe("sweepTails", () => {
  const open = tail(
    "I changed three files and the tests pass, and this note is long enough to skip the short rule.",
  );

  it("sends only rule-open tails to Laya and keeps order", async () => {
    const seen: number[] = [];
    const score: LayaScorer = async (tails) => {
      seen.push(tails.length);
      return tails.map(() => [0.9, 0.1] as const);
    };
    const out = await sweepTails([tail("OK"), open, tail("", "user")], score);
    expect(seen).toEqual([1]);
    expect(out.results.map((r) => `${r.verdict}:${r.source}`)).toEqual([
      "done:rule",
      "done:laya",
      "unfinished:rule",
    ]);
    expect(out.layaAvailable).toBe(true);
  });

  it("does not call Laya when the rules decide everything", async () => {
    let called = false;
    const out = await sweepTails([tail("OK")], async () => {
      called = true;
      return null;
    });
    expect(called).toBe(false);
    expect(out.layaAvailable).toBe(true);
  });

  it("abstains and reports Laya missing when the scorer returns null", async () => {
    const out = await sweepTails([open], async () => null);
    expect(out.layaAvailable).toBe(false);
    expect(out.results[0]?.verdict).toBe("abstain");
  });
});

describe("isSweepEligible", () => {
  const now = 1_000_000_000;
  const base = {
    archived: false,
    settled: false,
    pinned: false,
    running: false,
    updatedAtMs: now - 13 * 3_600_000,
  };
  const idle12h = 12 * 3_600_000;

  it("accepts an idle plain thread", () => {
    expect(isSweepEligible(base, now, idle12h)).toBe(true);
  });

  it("skips archived, settled, pinned, running and recent threads", () => {
    for (const patch of [
      { archived: true },
      { settled: true },
      { pinned: true },
      { running: true },
    ]) {
      expect(isSweepEligible({ ...base, ...patch }, now, idle12h)).toBe(false);
    }
    expect(isSweepEligible({ ...base, updatedAtMs: now - 3_600_000 }, now, idle12h)).toBe(false);
  });
});
