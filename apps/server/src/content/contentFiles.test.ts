// @effect-diagnostics nodeBuiltinImport:off - tests write real content files in a temp folder.
import { afterEach, describe, expect, it } from "@effect/vitest";
import * as NodeFS from "node:fs";
import * as NodeOS from "node:os";
import * as NodePath from "node:path";

import { listDeals, readDeal, signApproval, scriptHash } from "./contentFiles.ts";

const KEY = new Uint8Array(32).fill(7);
const roots: Array<string> = [];

afterEach(() => {
  for (const root of roots.splice(0)) NodeFS.rmSync(root, { recursive: true, force: true });
});

/** A temp workspace. The space in the name proves paths with spaces work. */
function workspace(): string {
  const root = NodeFS.mkdtempSync(NodePath.join(NodeOS.tmpdir(), "content lens-"));
  roots.push(root);
  return root;
}

function write(root: string, path: string, text: string): void {
  const file = NodePath.join(root, path);
  NodeFS.mkdirSync(NodePath.dirname(file), { recursive: true });
  NodeFS.writeFileSync(file, text);
}

const DEAL = `---
type: deal
brand: "Acme Cases"
stage: "contracted"
drive_folder_id: "folder123"
do_not:
  - "cheap"
---
# Acme Cases
`;

const video = (
  front: string,
  script = 'VISUAL: Phone drops.\nSPOKEN: "This case saved my phone."',
) =>
  `---\ntype: video\nid: video-acme-01\ndeal: acme-cases\ntitle: "Drop test"\n${front}\n---\n## Idea\n\nDrop the phone.\n\n## Script\n\n${script}\n\n## Shot list\n\n- Wide shot\n\n## Notes\n\nFilm outside.\n`;

describe("listDeals", () => {
  it("lists only folder deals with a deal.md", () => {
    const root = workspace();
    write(root, "deals/acme-cases/deal.md", DEAL);
    write(root, "deals/acme-cases/01-drop-test.md", video("stage: idea"));
    write(root, "deals/flat-prospect.md", DEAL);
    write(root, "deals/no-card/01-x.md", video("stage: idea"));
    write(root, "deals/_lens/settings.json", "{}");

    const { records, bad } = listDeals(root, KEY);
    expect(records.map((deal) => deal.slug)).toEqual(["acme-cases"]);
    expect(records[0]!.brand).toBe("Acme Cases");
    expect(records[0]!.driveFolderId).toBe("folder123");
    expect(records[0]!.doNot).toEqual(["cheap"]);
    expect(bad).toEqual([]);
  });

  it("is empty when the workspace has no deals folder", () => {
    expect(listDeals(workspace(), KEY)).toEqual({ records: [], bad: [] });
  });

  it("reads video frontmatter and sections, CRLF or LF", () => {
    const root = workspace();
    write(root, "deals/acme-cases/deal.md", DEAL.replaceAll("\n", "\r\n"));
    write(
      root,
      "deals/acme-cases/01-drop-test.md",
      video("stage: scripting\nlength_s: 30\nfootage:\n  - fileA\n  - fileB").replaceAll(
        "\n",
        "\r\n",
      ),
    );
    const deal = readDeal(root, KEY, "acme-cases")!;
    const [first] = deal.videos;
    expect(first).toMatchObject({
      deal: "acme-cases",
      file: "01-drop-test",
      id: "video-acme-01",
      title: "Drop test",
      stage: "scripting",
      approval: "none",
      revision: 0,
      lengthS: 30,
      footage: ["fileA", "fileB"],
      idea: "Drop the phone.",
      shotList: "- Wide shot",
      notes: "Film outside.",
    });
    expect(first!.script).toContain('SPOKEN: "This case saved my phone."');
  });

  it("reports a bad video file and still lists the rest", () => {
    const root = workspace();
    write(root, "deals/acme-cases/deal.md", DEAL);
    write(root, "deals/acme-cases/01-drop-test.md", video("stage: idea"));
    write(root, "deals/acme-cases/02-broken.md", video("stage: launched"));
    write(root, "deals/acme-cases/03-no-front.md", "just text");
    write(root, "deals/acme-cases/notes.md", "not a video file name");

    const { records, bad } = listDeals(root, KEY);
    expect(records[0]!.videos.map((v) => v.file)).toEqual(["01-drop-test"]);
    expect(bad.map((b) => b.file)).toEqual([
      "deals/acme-cases/02-broken.md",
      "deals/acme-cases/03-no-front.md",
    ]);
  });

  it("refuses a deal slug that leaves the deals folder", () => {
    const root = workspace();
    expect(readDeal(root, KEY, "../secrets")).toBeNull();
    expect(readDeal(root, KEY, "missing-deal")).toBeNull();
  });
});

describe("approval", () => {
  const approvedFront = (sig: string, hash: string) =>
    `stage: ready_to_film\napproved_by: "Jake"\napproved_at: "2026-10-29T20:00:00Z"\nscript_hash: "${hash}"\napproval_sig: "${sig}"`;
  const SCRIPT = 'VISUAL: Phone drops.\nSPOKEN: "This case saved my phone."';

  it("a signed approval keeps the stage", () => {
    const root = workspace();
    const hash = scriptHash(SCRIPT);
    const sig = signApproval(KEY, {
      deal: "acme-cases",
      file: "01-drop-test",
      scriptHash: hash,
      approvedBy: "Jake",
      approvedAt: "2026-10-29T20:00:00Z",
    });
    write(root, "deals/acme-cases/deal.md", DEAL);
    write(root, "deals/acme-cases/01-drop-test.md", video(approvedFront(sig, hash), SCRIPT));
    const [first] = readDeal(root, KEY, "acme-cases")!.videos;
    expect(first).toMatchObject({
      stage: "ready_to_film",
      approval: "approved",
      approvedBy: "Jake",
    });
  });

  it("a hand-written approval reads as script review", () => {
    const root = workspace();
    write(root, "deals/acme-cases/deal.md", DEAL);
    write(
      root,
      "deals/acme-cases/01-drop-test.md",
      video(approvedFront("ab".repeat(32), scriptHash(SCRIPT)), SCRIPT),
    );
    const [first] = readDeal(root, KEY, "acme-cases")!.videos;
    expect(first).toMatchObject({ stage: "script_review", approval: "unsigned" });
  });

  it("a stage past review with no approval reads as script review", () => {
    const root = workspace();
    write(root, "deals/acme-cases/deal.md", DEAL);
    write(root, "deals/acme-cases/01-drop-test.md", video("stage: paid"));
    const [first] = readDeal(root, KEY, "acme-cases")!.videos;
    expect(first).toMatchObject({ stage: "script_review", approval: "none" });
  });

  it("an edit after approval voids it", () => {
    const root = workspace();
    const hash = scriptHash(SCRIPT);
    const sig = signApproval(KEY, {
      deal: "acme-cases",
      file: "01-drop-test",
      scriptHash: hash,
      approvedBy: "Jake",
      approvedAt: "2026-10-29T20:00:00Z",
    });
    write(root, "deals/acme-cases/deal.md", DEAL);
    write(
      root,
      "deals/acme-cases/01-drop-test.md",
      video(approvedFront(sig, hash), `${SCRIPT}\nSPOKEN: "Buy it now."`),
    );
    const [first] = readDeal(root, KEY, "acme-cases")!.videos;
    expect(first).toMatchObject({ stage: "script_review", approval: "content_changed" });
  });

  it("a signature from another key does not count", () => {
    const root = workspace();
    const hash = scriptHash(SCRIPT);
    const sig = signApproval(new Uint8Array(32).fill(9), {
      deal: "acme-cases",
      file: "01-drop-test",
      scriptHash: hash,
      approvedBy: "Jake",
      approvedAt: "2026-10-29T20:00:00Z",
    });
    write(root, "deals/acme-cases/deal.md", DEAL);
    write(root, "deals/acme-cases/01-drop-test.md", video(approvedFront(sig, hash), SCRIPT));
    expect(readDeal(root, KEY, "acme-cases")!.videos[0]!.approval).toBe("unsigned");
  });
});

describe("scorecard", () => {
  it("counts spoken seconds and finds banned words and brand do-nots", () => {
    const root = workspace();
    write(root, "deals/acme-cases/deal.md", DEAL);
    write(
      root,
      "deals/_lens/voice-bible.md",
      '---\nbanned_words:\n  - "game changer"\n---\n# Voice\n',
    );
    write(
      root,
      "deals/acme-cases/01-drop-test.md",
      video(
        "stage: scripting\nlength_s: 30\nhook_score: 5",
        'SPOKEN: "This cheap case is a Game Changer for you."\nVISUAL: cheap shot',
      ),
    );
    const { scorecard } = readDeal(root, KEY, "acme-cases")!.videos[0]!;
    expect(scorecard.spokenSeconds).toBe(4);
    expect(scorecard.bannedWords).toEqual(["game changer"]);
    expect(scorecard.doNotHits).toEqual(["cheap"]);
    expect(scorecard.blocks).toEqual(['Banned word: "game changer"', 'Brand do-not: "cheap"']);
    expect(scorecard.warnings).toEqual([
      "Hook score 5 is under 7.",
      "Spoken length 4 s is far from the 30 s target.",
    ]);
  });

  it("does not match a banned word inside a longer word", () => {
    const root = workspace();
    write(root, "deals/acme-cases/deal.md", DEAL.replace('  - "cheap"', '  - "ad"'));
    write(
      root,
      "deals/acme-cases/01-drop-test.md",
      video("stage: idea", 'SPOKEN: "Add it today."'),
    );
    expect(readDeal(root, KEY, "acme-cases")!.videos[0]!.scorecard.doNotHits).toEqual([]);
  });
});
