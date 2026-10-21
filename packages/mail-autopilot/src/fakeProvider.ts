import {
  assertDraftInput,
  type DraftInfo,
  type DraftInput,
  type LabelChange,
  type MailProvider,
  ProviderError,
} from "./provider.ts";
import type { MailMessage } from "./types.ts";

/** In-memory mailbox for tests. Behaves like the contract in `providerContract.ts`. */
export class FakeMailProvider implements MailProvider {
  private messages: MailMessage[] = [];
  private drafts = new Map<string, DraftInfo>();
  private counter = 0;
  /** Test hook: make the next call to a method throw. */
  failNext = new Map<string, ProviderError>();

  seed(messages: readonly MailMessage[]): void {
    this.messages.push(...messages);
  }

  editDraft(draftId: string, body: string): void {
    const d = this.drafts.get(draftId);
    if (d) this.drafts.set(draftId, { ...d, body, messageId: `dm${++this.counter}` });
  }

  private maybeFail(method: string): void {
    const err = this.failNext.get(method);
    if (err) {
      this.failNext.delete(method);
      throw err;
    }
  }

  private find(id: string): number {
    const i = this.messages.findIndex((m) => m.id === id);
    if (i < 0) throw new ProviderError("not_found", `no message ${id}`);
    return i;
  }

  async listNew(cursor: string | null) {
    this.maybeFail("listNew");
    const from = cursor === null ? 0 : Number(cursor);
    return {
      ids: this.messages.slice(from).map((m) => m.id),
      cursor: String(this.messages.length),
    };
  }

  async getMessage(id: string) {
    this.maybeFail("getMessage");
    return this.messages[this.find(id)]!;
  }

  async ensureLabel(_name: string) {
    this.maybeFail("ensureLabel");
  }

  async modifyLabels(id: string, change: LabelChange) {
    this.maybeFail("modifyLabels");
    const i = this.find(id);
    const m = this.messages[i]!;
    const kept = m.labels.filter((l) => !change.remove.includes(l));
    const added = change.add.filter((l) => !kept.includes(l));
    this.messages[i] = { ...m, labels: [...kept, ...added] };
  }

  async archive(id: string) {
    await this.modifyLabels(id, { add: [], remove: ["INBOX"] });
  }

  async createDraft(input: DraftInput) {
    this.maybeFail("createDraft");
    assertDraftInput(input);
    const n = ++this.counter;
    const draft: DraftInfo = { ...input, id: `d${n}`, messageId: `dm${n}` };
    this.drafts.set(draft.id, draft);
    return draft;
  }

  async getDraft(draftId: string) {
    this.maybeFail("getDraft");
    return this.drafts.get(draftId) ?? null;
  }

  async deleteDraft(draftId: string) {
    this.maybeFail("deleteDraft");
    this.drafts.delete(draftId);
  }
}
