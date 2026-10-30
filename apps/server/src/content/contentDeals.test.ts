// @effect-diagnostics nodeBuiltinImport:off - tests write real content files in a temp folder.
import { afterEach, describe, expect, it } from "@effect/vitest";
import * as NodeFS from "node:fs";
import * as NodeOS from "node:os";
import * as NodePath from "node:path";

import { ContentError, createDeal, listDeals, readDeal } from "./contentFiles.ts";

const KEY = new Uint8Array(32).fill(7);
const NOW = "2026-10-30T20:00:00.000Z";
const roots: Array<string> = [];

afterEach(() => {
  for (const root of roots.splice(0)) NodeFS.rmSync(root, { recursive: true, force: true });
});

function workspace(): string {
  const root = NodeFS.mkdtempSync(NodePath.join(NodeOS.tmpdir(), "content deals-"));
  roots.push(root);
  return root;
}

describe("createDeal", () => {
  it("makes a contracted deal folder that the board reads", () => {
    const root = workspace();
    const deal = createDeal(
      root,
      KEY,
      {
        brand: "Acme Cases",
        contact: "Sam <sam@example.invalid>",
        terms: "Three videos.\nPaid on delivery.",
        deadline: "2026-12-01",
        driveFolder: "https://drive.google.com/drive/folders/1AbCdEfGhIjKlMnOp?usp=sharing",
        briefLink: "https://example.invalid/brief",
      },
      NOW,
    );
    expect(deal).toMatchObject({
      slug: "acme-cases",
      brand: "Acme Cases",
      stage: "contracted",
      driveFolderId: "1AbCdEfGhIjKlMnOp",
      brief: "https://example.invalid/brief",
      videos: [],
    });
    expect(listDeals(root, KEY).records.map((record) => record.slug)).toEqual(["acme-cases"]);
    const card = NodeFS.readFileSync(NodePath.join(root, "deals/acme-cases/deal.md"), "utf8");
    expect(card).toContain("Paid on delivery.");
    expect(card).toContain('deadline: "2026-12-01"');
  });

  it("needs only a brand, and a plain Drive folder id is kept as it is", () => {
    const root = workspace();
    const deal = createDeal(root, KEY, { brand: "Lumen Lamp", driveFolder: "folder12345" }, NOW);
    expect(deal).toMatchObject({ slug: "lumen-lamp", driveFolderId: "folder12345" });
  });

  it("never replaces a deal that exists, even when the brand differs only in case or marks", () => {
    const root = workspace();
    createDeal(root, KEY, { brand: "Acme Cases" }, NOW);
    const before = NodeFS.readFileSync(NodePath.join(root, "deals/acme-cases/deal.md"), "utf8");
    for (const brand of ["Acme Cases", "ACME cases!", "acme  cases"]) {
      expect(() => createDeal(root, KEY, { brand }, NOW)).toThrow(/already exists/);
    }
    expect(NodeFS.readFileSync(NodePath.join(root, "deals/acme-cases/deal.md"), "utf8")).toBe(
      before,
    );
  });

  it("refuses a brand without letters or numbers, and bad dates and links", () => {
    const root = workspace();
    expect(() => createDeal(root, KEY, { brand: "   " }, NOW)).toThrow(ContentError);
    expect(() => createDeal(root, KEY, { brand: "!!!" }, NOW)).toThrow(/letters or numbers/);
    expect(() => createDeal(root, KEY, { brand: "A", deadline: "next week" }, NOW)).toThrow(
      /YYYY-MM-DD/,
    );
    expect(() =>
      createDeal(root, KEY, { brand: "A", briefLink: "javascript:alert(1)" }, NOW),
    ).toThrow(/web link/);
    expect(NodeFS.existsSync(NodePath.join(root, "deals/a"))).toBe(false);
  });

  it("keeps hostile text on its own line: no extra frontmatter key, no path escape", () => {
    const root = workspace();
    const deal = createDeal(
      root,
      KEY,
      { brand: '../../Evil "Co"\nstage: paid', contact: "Sam\nstage: paid" },
      NOW,
    );
    expect(deal.stage).toBe("contracted");
    expect(deal.slug).toBe("evil-co-stage-paid");
    expect(readDeal(root, KEY, deal.slug)?.brand).toBe('../../Evil "Co" stage: paid');
    expect(NodeFS.readdirSync(NodePath.join(root, "deals"))).toEqual(["evil-co-stage-paid"]);
  });
});
