// @effect-diagnostics nodeBuiltinImport:off - tests write real content files in a temp folder.
import { afterEach, describe, expect, it } from "@effect/vitest";
import * as NodeFS from "node:fs";
import * as NodeOS from "node:os";
import * as NodePath from "node:path";

import { listDeals } from "./contentFiles.ts";
import { decideProposal, listProposals, proposeDeal, readIntake } from "./contentIntake.ts";

const KEY = new Uint8Array(32).fill(7);
const NOW = "2026-10-30T20:00:00.000Z";
const AGENT = { kind: "agent", name: "thread t1" } as const;
const roots: Array<string> = [];

afterEach(() => {
  for (const root of roots.splice(0)) NodeFS.rmSync(root, { recursive: true, force: true });
});

/** A made-up workspace. `intake` is written as the deal_intake setting, or left unset. */
function workspace(intake?: string): string {
  const root = NodeFS.mkdtempSync(NodePath.join(NodeOS.tmpdir(), "content intake-"));
  roots.push(root);
  if (intake !== undefined) {
    NodeFS.mkdirSync(NodePath.join(root, "deals/_lens"), { recursive: true });
    NodeFS.writeFileSync(
      NodePath.join(root, "deals/_lens/settings.json"),
      JSON.stringify({ deal_intake: intake }),
    );
  }
  return root;
}

const ACME = {
  brand: "Acme Cases",
  contact: "Sam <sam@example.invalid>",
  terms: "Two videos.\nPaid on delivery.",
  deadline: "2026-12-01",
  source: "Email from Sam, Oct 28",
};
const exists = (root: string, path: string) => NodeFS.existsSync(NodePath.join(root, path));

describe("deal_intake setting", () => {
  it("is manual when the file is missing, broken or names an unknown mode", () => {
    expect(readIntake(workspace())).toBe("manual");
    expect(readIntake(workspace("sometimes"))).toBe("manual");
    const broken = workspace();
    NodeFS.mkdirSync(NodePath.join(broken, "deals/_lens"), { recursive: true });
    NodeFS.writeFileSync(NodePath.join(broken, "deals/_lens/settings.json"), "{ nope");
    expect(readIntake(broken)).toBe("manual");
  });

  it("reads each mode", () => {
    for (const mode of ["manual", "ask", "propose", "auto"] as const) {
      expect(readIntake(workspace(mode))).toBe(mode);
    }
  });
});

describe("proposeDeal", () => {
  it("refuses an agent in manual mode and writes nothing", () => {
    const root = workspace("manual");
    expect(() => proposeDeal(root, KEY, ACME, AGENT, NOW)).toThrow(/manual/);
    expect(listProposals(root)).toEqual([]);
    expect(exists(root, "deals/acme-cases")).toBe(false);
    expect(exists(root, "deals/_lens/proposed")).toBe(false);
  });

  it("refuses when no setting exists, because manual is the default", () => {
    expect(() => proposeDeal(workspace(), KEY, ACME, AGENT, NOW)).toThrow(/manual/);
  });

  it.each(["ask", "propose"])("%s mode makes a proposal that never shows as a deal", (mode) => {
    const root = workspace(mode);
    const result = proposeDeal(root, KEY, ACME, AGENT, NOW);
    expect(result.intake).toBe(mode);
    expect(result.proposal).toMatchObject({
      slug: "acme-cases",
      brand: "Acme Cases",
      terms: "Two videos.\nPaid on delivery.",
      deadline: "2026-12-01",
      source: "Email from Sam, Oct 28",
      proposedBy: "thread t1",
    });
    expect(result.deal).toBeUndefined();
    expect(listProposals(root).map((proposal) => proposal.slug)).toEqual(["acme-cases"]);
    expect(listDeals(root, KEY).records).toEqual([]);
    expect(exists(root, "deals/acme-cases")).toBe(false);
  });

  it("auto mode starts the deal at once", () => {
    const root = workspace("auto");
    const result = proposeDeal(root, KEY, ACME, AGENT, NOW);
    expect(result.deal).toMatchObject({ slug: "acme-cases", stage: "contracted" });
    expect(result.proposal).toBeUndefined();
    expect(listProposals(root)).toEqual([]);
  });

  it("refuses a second proposal, a deal that exists, and bad input", () => {
    const root = workspace("propose");
    proposeDeal(root, KEY, ACME, AGENT, NOW);
    expect(() => proposeDeal(root, KEY, ACME, AGENT, NOW)).toThrow(/already proposed/);
    NodeFS.mkdirSync(NodePath.join(root, "deals/lumen-lamp"), { recursive: true });
    expect(() => proposeDeal(root, KEY, { brand: "Lumen Lamp" }, AGENT, NOW)).toThrow(
      /already exists/,
    );
    expect(() => proposeDeal(root, KEY, { brand: "!!!" }, AGENT, NOW)).toThrow(
      /letters or numbers/,
    );
    expect(() => proposeDeal(root, KEY, { brand: "B", deadline: "soon" }, AGENT, NOW)).toThrow(
      /YYYY-MM-DD/,
    );
  });

  it("stops at 50 waiting proposals, so an agent cannot flood the list", () => {
    const root = workspace("propose");
    for (let i = 0; i < 50; i++) proposeDeal(root, KEY, { brand: `Brand ${i}` }, AGENT, NOW);
    expect(() => proposeDeal(root, KEY, { brand: "One more" }, AGENT, NOW)).toThrow(/50 proposed/);
    decideProposal(root, KEY, "brand-0", "dismiss", NOW);
    expect(proposeDeal(root, KEY, { brand: "One more" }, AGENT, NOW).proposal?.slug).toBe(
      "one-more",
    );
  });

  it("keeps hostile text on its own line", () => {
    const root = workspace("propose");
    proposeDeal(root, KEY, { brand: "Evil", contact: "x\ntype: deal", source: "a\nb" }, AGENT, NOW);
    const [proposal] = listProposals(root);
    expect(proposal).toMatchObject({ slug: "evil", contact: "x type: deal", source: "a b" });
  });
});

describe("decideProposal", () => {
  const proposed = () => {
    const root = workspace("propose");
    proposeDeal(root, KEY, ACME, AGENT, NOW);
    return root;
  };

  it("confirm makes the deal with the proposal's fields and removes the proposal", () => {
    const root = proposed();
    const result = decideProposal(root, KEY, "acme-cases", "confirm", NOW);
    expect(result.deal).toMatchObject({
      slug: "acme-cases",
      brand: "Acme Cases",
      stage: "contracted",
    });
    expect(listDeals(root, KEY).records.map((deal) => deal.slug)).toEqual(["acme-cases"]);
    expect(listProposals(root)).toEqual([]);
    expect(result.paths).toEqual([
      "deals/acme-cases/deal.md",
      "deals/_lens/proposed/acme-cases.md",
    ]);
    expect(NodeFS.readFileSync(NodePath.join(root, "deals/acme-cases/deal.md"), "utf8")).toContain(
      "Paid on delivery.",
    );
  });

  it("dismiss removes the proposal and makes no deal", () => {
    const root = proposed();
    const result = decideProposal(root, KEY, "acme-cases", "dismiss", NOW);
    expect(result.deal).toBeUndefined();
    expect(result.paths).toEqual(["deals/_lens/proposed/acme-cases.md"]);
    expect(listProposals(root)).toEqual([]);
    expect(exists(root, "deals/acme-cases")).toBe(false);
  });

  it("keeps the proposal when the deal cannot be made", () => {
    const root = proposed();
    NodeFS.mkdirSync(NodePath.join(root, "deals/acme-cases"), { recursive: true });
    expect(() => decideProposal(root, KEY, "acme-cases", "confirm", NOW)).toThrow(/already exists/);
    expect(listProposals(root)).toHaveLength(1);
  });

  it("refuses an unknown proposal and a slug that is a path", () => {
    const root = proposed();
    expect(() => decideProposal(root, KEY, "nobody", "confirm", NOW)).toThrow(/No proposed deal/);
    expect(() => decideProposal(root, KEY, "../../x", "dismiss", NOW)).toThrow(/No proposed deal/);
  });
});
