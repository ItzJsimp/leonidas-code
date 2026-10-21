import { assert, describe, it } from "@effect/vitest";

import type { MailProvider } from "./provider.ts";
import { ProviderError } from "./provider.ts";
import { msg } from "./testkit.ts";
import type { MailMessage } from "./types.ts";

export interface ContractHarness {
  readonly provider: MailProvider;
  /** Put messages in the mailbox, each with the INBOX label plus its own labels. */
  readonly seed: (messages: readonly MailMessage[]) => void;
  /** Change a draft's text the way a user does in Gmail: the draft keeps its id, its message id changes. */
  readonly editDraft: (draftId: string, body: string) => void;
}

/** One suite for every provider, so the fake and the real adapter cannot drift apart. */
export const runProviderContract = (name: string, make: () => ContractHarness): void => {
  describe(`MailProvider contract: ${name}`, () => {
    const inbox = (id: string, over: Partial<MailMessage> = {}) =>
      msg({ id, threadId: `t-${id}`, labels: ["INBOX"], ...over });

    it("listNew returns only mail after the cursor", async () => {
      const h = make();
      h.seed([inbox("a"), inbox("b")]);
      const first = await h.provider.listNew(null);
      assert.sameMembers([...first.ids], ["a", "b"]);
      h.seed([inbox("c")]);
      const second = await h.provider.listNew(first.cursor);
      assert.deepEqual([...second.ids], ["c"]);
      const third = await h.provider.listNew(second.cursor);
      assert.deepEqual([...third.ids], []);
    });

    it("getMessage returns the message and rejects an unknown id", async () => {
      const h = make();
      h.seed([inbox("a", { subject: "Hi" })]);
      assert.equal((await h.provider.getMessage("a")).subject, "Hi");
      const err = await h.provider.getMessage("nope").catch((e: unknown) => e);
      assert.instanceOf(err, ProviderError);
      assert.equal((err as ProviderError).code, "not_found");
    });

    it("modifyLabels adds and removes, and repeating it changes nothing", async () => {
      const h = make();
      h.seed([inbox("a")]);
      await h.provider.ensureLabel("SG/Pitch");
      await h.provider.modifyLabels("a", { add: ["SG/Pitch"], remove: [] });
      await h.provider.modifyLabels("a", { add: ["SG/Pitch"], remove: [] });
      assert.sameMembers([...(await h.provider.getMessage("a")).labels], ["INBOX", "SG/Pitch"]);
      await h.provider.modifyLabels("a", { add: [], remove: ["SG/Pitch"] });
      await h.provider.modifyLabels("a", { add: [], remove: ["SG/Pitch"] });
      assert.deepEqual([...(await h.provider.getMessage("a")).labels], ["INBOX"]);
    });

    it("archive removes INBOX and nothing else, twice is fine", async () => {
      const h = make();
      h.seed([inbox("a", { labels: ["INBOX", "STARRED"] })]);
      await h.provider.archive("a");
      await h.provider.archive("a");
      assert.deepEqual([...(await h.provider.getMessage("a")).labels], ["STARRED"]);
    });

    it("createDraft, getDraft and deleteDraft round trip", async () => {
      const h = make();
      h.seed([inbox("a")]);
      const made = await h.provider.createDraft({
        threadId: "t-a",
        to: "sam@example.test",
        subject: "Re: Hi",
        body: "Thanks!\nGersi",
      });
      const got = await h.provider.getDraft(made.id);
      assert.isNotNull(got);
      assert.equal(got?.body, "Thanks!\nGersi");
      assert.equal(got?.subject, "Re: Hi");
      assert.equal(got?.messageId, made.messageId);
      await h.provider.deleteDraft(made.id);
      await h.provider.deleteDraft(made.id);
      assert.isNull(await h.provider.getDraft(made.id));
    });

    it("an edited draft gets a new message id", async () => {
      const h = make();
      h.seed([inbox("a")]);
      const made = await h.provider.createDraft({
        threadId: "t-a",
        to: "sam@example.test",
        subject: "Re: Hi",
        body: "one",
      });
      h.editDraft(made.id, "two");
      const got = await h.provider.getDraft(made.id);
      assert.equal(got?.body, "two");
      assert.notEqual(got?.messageId, made.messageId);
    });

    it("createDraft rejects line breaks in to and subject", async () => {
      const h = make();
      h.seed([inbox("a")]);
      const base = { threadId: "t-a", to: "sam@example.test", subject: "Re: Hi", body: "x" };
      for (const bad of [
        { ...base, subject: "Hi\r\nBcc: evil@example.test" },
        { ...base, subject: "Hi" + String.fromCharCode(0x2028) + "Bcc: evil@example.test" },
        { ...base, to: "sam@example.test\nBcc: evil@example.test" },
        { ...base, to: "a@example.test, b@example.test" },
      ]) {
        const err = await h.provider.createDraft(bad).catch((e: unknown) => e);
        assert.instanceOf(err, ProviderError);
        assert.equal((err as ProviderError).code, "invalid");
      }
    });
  });
};
