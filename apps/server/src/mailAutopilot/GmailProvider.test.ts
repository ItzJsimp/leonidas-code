// @effect-diagnostics nodeBuiltinImport:off - the source scan reads this folder with plain fs.
import * as NodeFS from "node:fs";

import { assert, describe, it } from "@effect/vitest";
import { ProviderError } from "@t3tools/mail-autopilot";
import { msg, runProviderContract } from "@t3tools/mail-autopilot/testing";

import { ALLOWED_ROUTES } from "./gmailRequest.ts";
import { buildRawDraft, decodeWords, encodeWord, parseAddress } from "./gmailMime.ts";
import { makeGmailProvider } from "./GmailProvider.ts";
import { GmailSimulator } from "./gmailSimulator.ts";

const make = () => {
  const sim = new GmailSimulator();
  const provider = makeGmailProvider({
    fetch: sim.fetch,
    getAccessToken: async () => "tok",
    sleep: async () => {},
  });
  return { sim, provider };
};

runProviderContract("GmailProvider (simulated Gmail)", () => {
  const { sim, provider } = make();
  return {
    provider,
    seed: (m) => sim.seed(m),
    editDraft: (id, body) => sim.editDraft(id, body),
  };
});

describe("GmailProvider mapping", () => {
  it("maps a rich message to a MailMessage", async () => {
    const { sim, provider } = make();
    sim.seed([
      msg({
        id: "a",
        threadId: "ta",
        fromName: "Sam Example",
        fromAddress: "Sam@Example.test",
        subject: "Contract for the shoot",
        snippet: "Here's the agreement",
        attachmentNames: ["agreement.pdf"],
        listUnsubscribe: true,
        labels: ["INBOX", "SG/Pitch"],
        ownRepliedInThread: true,
      }),
    ]);
    const got = await provider.getMessage("a");
    assert.equal(got.fromName, "Sam Example");
    assert.equal(got.fromAddress, "sam@example.test");
    assert.equal(got.subject, "Contract for the shoot");
    assert.equal(got.snippet, "Here's the agreement");
    assert.deepEqual([...got.attachmentNames], ["agreement.pdf"]);
    assert.isTrue(got.listUnsubscribe);
    assert.isTrue(got.ownRepliedInThread);
    assert.isFalse(got.isOwn);
    assert.sameMembers([...got.labels], ["INBOX", "SG/Pitch"]);
  });

  it("marks mail the owner sent", async () => {
    const { sim, provider } = make();
    sim.seed([msg({ id: "a", isOwn: true, labels: [] })]);
    assert.isTrue((await provider.getMessage("a")).isOwn);
  });

  it("gives a typed error for a reply it cannot read", async () => {
    const { sim, provider } = make();
    sim.seed([msg({ id: "a", labels: ["INBOX"] })]);
    sim.breakNextMessage({ nothing: "useful" });
    const err = await provider.getMessage("a").catch((e: unknown) => e);
    assert.instanceOf(err, ProviderError);
    assert.equal((err as ProviderError).code, "transient");
  });
});

describe("GmailProvider listNew", () => {
  it("starts from the profile history id and then reads only the history", async () => {
    const { sim, provider } = make();
    sim.seed([msg({ id: "a", labels: ["INBOX"] })]);
    const first = await provider.listNew(null);
    assert.deepEqual([...first.ids], ["a"]);
    sim.seed([msg({ id: "b", labels: ["INBOX"] })]);
    const second = await provider.listNew(first.cursor);
    assert.deepEqual([...second.ids], ["b"]);
    assert.include(sim.requests, "GET /history");
  });

  it("falls back to the inbox list when the cursor is too old", async () => {
    const { sim, provider } = make();
    sim.seed([msg({ id: "a", labels: ["INBOX"] })]);
    const got = await provider.listNew("stale");
    assert.deepEqual([...got.ids], ["a"]);
  });
});

describe("gmail mime", () => {
  it("round trips non-ASCII words and joins adjacent encoded words", () => {
    const text = "Re: 日本語のテスト 😀 café";
    assert.equal(decodeWords(encodeWord(text)), text);
    assert.equal(decodeWords("=?UTF-8?Q?Caf=C3=A9_Noir?="), "Café Noir");
    assert.equal(decodeWords("=?UTF-8?B?SGk=?= =?UTF-8?B?IHRoZXJl?="), "Hi there");
  });

  it("leaves plain ASCII alone and never emits a bare line break", () => {
    assert.equal(encodeWord("Re: Hello"), "Re: Hello");
    assert.notMatch(encodeWord("é".repeat(200)), /\r\n(?! )/);
  });

  it("parses sender headers", () => {
    assert.deepEqual(parseAddress('"Sam, Example" <Sam@Example.test>'), {
      name: "Sam, Example",
      address: "sam@example.test",
    });
    assert.deepEqual(parseAddress("sam@example.test"), { name: "", address: "sam@example.test" });
    assert.deepEqual(parseAddress("=?UTF-8?B?U8OhbQ==?= <s@example.test>"), {
      name: "Sám",
      address: "s@example.test",
    });
  });

  it("builds a draft whose headers hold one value each and whose body decodes", () => {
    const raw = buildRawDraft({
      threadId: "t",
      to: "sam@example.test",
      subject: "Re: café",
      body: "Line one\nLine two é",
    });
    const text = Buffer.from(raw, "base64url").toString("utf8");
    const [head = "", body = ""] = text.split("\r\n\r\n");
    assert.match(head, /^To: sam@example\.test\r\n/);
    assert.match(head, /MIME-Version: 1\.0/);
    assert.match(head, /Content-Type: text\/plain; charset=UTF-8/);
    assert.equal(head.split("\r\n").filter((l) => /^Bcc:/i.test(l)).length, 0);
    assert.equal(
      Buffer.from(body.replaceAll("\r\n", ""), "base64").toString("utf8"),
      "Line one\nLine two é",
    );
  });

  it("refuses a recipient that is not plain ASCII", () => {
    const attempt = () =>
      buildRawDraft({ threadId: "t", to: "sám@example.test", subject: "x", body: "x" });
    assert.throws(attempt);
  });
});

describe("GmailProvider fence", () => {
  it("only uses allow-listed calls over a full contract-style session", async () => {
    const { sim, provider } = make();
    sim.seed([msg({ id: "a", threadId: "ta", labels: ["INBOX"] })]);
    await provider.listNew(null);
    await provider.getMessage("a");
    await provider.ensureLabel("SG/Pitch");
    await provider.modifyLabels("a", { add: ["SG/Pitch"], remove: [] });
    await provider.archive("a");
    const d = await provider.createDraft({
      threadId: "ta",
      to: "sam@example.test",
      subject: "Re: x",
      body: "hi",
    });
    await provider.getDraft(d.id);
    await provider.deleteDraft(d.id);
    assert.isAbove(sim.requests.length, 8);
    for (const r of sim.requests) {
      const path = r.replace(" ", " /gmail/v1/users/me");
      assert.isTrue(
        ALLOWED_ROUTES.some((re) => re.test(path)),
        `${r} is not allow-listed`,
      );
    }
  });

  it("keeps the word send out of every non-test source file in this folder", () => {
    const dir = new URL(".", import.meta.url);
    const files = NodeFS.readdirSync(dir).filter(
      (f) => f.endsWith(".ts") && !f.endsWith(".test.ts"),
    );
    assert.isAbove(files.length, 2);
    for (const f of files) {
      const text = NodeFS.readFileSync(new URL(f, dir), "utf8");
      assert.notMatch(text, /send|forward/i, `${f} mentions send or forward`);
    }
  });
});

describe("GmailProvider labels", () => {
  it("refuses empty, long and control-character label names", async () => {
    const { provider } = make();
    for (const name of ["", "x".repeat(226), "bad\nname", "tab\tname"]) {
      const err = await provider.ensureLabel(name).catch((e: unknown) => e);
      assert.instanceOf(err, ProviderError);
      assert.equal((err as ProviderError).code, "invalid");
    }
  });
});
