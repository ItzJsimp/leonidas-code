// @effect-diagnostics nodeBuiltinImport:off - tests run real git in temp folders.
import { afterEach, describe, expect, it } from "@effect/vitest";

import { cleanTemp, g, tempDir, write } from "../areaSync/engine/testRepos.ts";
import { findVideo, moveStage, saveScript } from "./contentFiles.ts";
import { recordChange, scriptHistory, videoRel } from "./contentGit.ts";

const KEY = new Uint8Array(32).fill(7);
const NOW = "2026-10-29T21:00:00.000Z";
const agent = { kind: "agent", name: "thread t1" } as const;
const gersi = { kind: "member", name: "Gersi" } as const;
const REL = videoRel("acme-cases", "01-drop-test");

afterEach(cleanTemp);

/** A Git workspace with one deal and one video in scripting. The space proves quoted paths. */
function repo(): string {
  const root = tempDir("content git-");
  g(root, "init", "-q", "-b", "main");
  g(root, "config", "user.name", "Test");
  g(root, "config", "user.email", "test@example.invalid");
  write(root, "deals/acme-cases/deal.md", '---\nbrand: "Acme Cases"\ndo_not:\n  - "cheap"\n---\n');
  write(
    root,
    "deals/acme-cases/01-drop-test.md",
    '---\ntitle: "Drop test"\nstage: scripting\nlength_s: 10\n---\n## Idea\n\nDrop it.\n\n## Script\n\n\n## Notes\n\n',
  );
  g(root, "add", "-A");
  g(root, "commit", "-q", "-m", "seed");
  return root;
}

const agentDraft = async (root: string, script: string) => {
  saveScript(
    root,
    KEY,
    { deal: "acme-cases", file: "01-drop-test", script, hookScore: 8, writerModel: "model-a" },
    agent,
    NOW,
  );
  return recordChange(root, REL, {
    actor: agent,
    what: "script",
    deal: "acme-cases",
    file: "01-drop-test",
  });
};

describe("recordChange", () => {
  it("tags each agent draft as a numbered baseline", async () => {
    const root = repo();
    expect(await agentDraft(root, 'SPOKEN: "First take of the hook."')).toEqual({
      committed: true,
      detail: "",
    });
    await agentDraft(root, 'SPOKEN: "Second take of the hook."');
    const log = g(
      root,
      "log",
      "--format=%s|%(trailers:key=Script-Baseline,valueonly,separator=;)",
      "-2",
    );
    expect(log.split("\n").map((line) => line.trim())).toEqual([
      "Script(agent): acme-cases/01-drop-test v2|yes",
      "Script(agent): acme-cases/01-drop-test v1|yes",
    ]);
  });

  it("commits a person's edit under their name, without the baseline tag", async () => {
    const root = repo();
    await agentDraft(root, 'SPOKEN: "First take of the hook."');
    saveScript(
      root,
      KEY,
      { deal: "acme-cases", file: "01-drop-test", script: 'SPOKEN: "My own words."' },
      gersi,
      NOW,
    );
    await recordChange(root, REL, {
      actor: gersi,
      what: "script",
      deal: "acme-cases",
      file: "01-drop-test",
    });
    expect(
      g(
        root,
        "log",
        "-1",
        "--format=%s|%(trailers:key=Script-Baseline,valueonly,separator=;)",
      ).trim(),
    ).toBe("Script(Gersi): acme-cases/01-drop-test|");
  });

  it("commits only its own file and leaves other changes alone", async () => {
    const root = repo();
    write(root, "other.md", "someone else's work");
    g(root, "add", "other.md");
    await agentDraft(root, 'SPOKEN: "First take of the hook."');
    expect(g(root, "show", "--name-only", "--format=", "HEAD")).toBe(REL);
    expect(g(root, "diff", "--cached", "--name-only")).toBe("other.md");
  });

  it("records a stage move", async () => {
    const root = repo();
    await agentDraft(root, 'SPOKEN: "First take of the hook."');
    moveStage(
      root,
      KEY,
      { deal: "acme-cases", file: "01-drop-test", to: "script_review" },
      agent,
      NOW,
    );
    await recordChange(root, REL, {
      actor: agent,
      what: "stage",
      deal: "acme-cases",
      file: "01-drop-test",
      to: "script_review",
    });
    expect(g(root, "log", "-1", "--format=%s")).toBe(
      "Content(agent): acme-cases/01-drop-test to script_review",
    );
  });

  it("says so when the workspace is not a Git repo", async () => {
    const root = tempDir("content plain-");
    write(root, "deals/acme-cases/01-drop-test.md", "x");
    const result = await recordChange(root, REL, {
      actor: gersi,
      what: "script",
      deal: "acme-cases",
      file: "01-drop-test",
    });
    expect(result.committed).toBe(false);
  });
});

describe("scriptHistory", () => {
  it("returns the latest agent baseline beside the script now", async () => {
    const root = repo();
    await agentDraft(root, 'SPOKEN: "Agent words."');
    saveScript(
      root,
      KEY,
      { deal: "acme-cases", file: "01-drop-test", script: 'SPOKEN: "Gersi words."' },
      gersi,
      NOW,
    );
    await recordChange(root, REL, {
      actor: gersi,
      what: "script",
      deal: "acme-cases",
      file: "01-drop-test",
    });
    const history = await scriptHistory(root, "acme-cases", "01-drop-test");
    expect(history.baseline).toBe('SPOKEN: "Agent words."');
    expect(history.baselineCommit).toMatch(/^[0-9a-f]{40}$/);
    expect(findVideo(root, KEY, "acme-cases", "01-drop-test").script).toBe(
      'SPOKEN: "Gersi words."',
    );
  });

  it("is empty before the first agent draft", async () => {
    expect(await scriptHistory(repo(), "acme-cases", "01-drop-test")).toEqual({
      baseline: null,
      baselineCommit: null,
    });
  });
});
