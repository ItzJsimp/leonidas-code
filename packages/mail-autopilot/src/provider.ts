import type { MailMessage } from "./types.ts";

/** Every call a provider offers. Closed on purpose: there is no way to deliver mail from here. */
export const PROVIDER_METHODS = [
  "listNew",
  "getMessage",
  "ensureLabel",
  "modifyLabels",
  "archive",
  "createDraft",
  "getDraft",
  "deleteDraft",
] as const;

export type ProviderErrorCode =
  | "not_found"
  | "invalid"
  | "rate_limited"
  | "transient"
  | "needsReconnect"
  | "blocked";

export class ProviderError extends Error {
  readonly code: ProviderErrorCode;
  constructor(code: ProviderErrorCode, message: string) {
    super(message);
    this.name = "ProviderError";
    this.code = code;
  }
}

export interface DraftInput {
  readonly threadId: string;
  /** One address. No list, no line breaks. */
  readonly to: string;
  /** One line. */
  readonly subject: string;
  readonly body: string;
}

export interface DraftInfo extends DraftInput {
  readonly id: string;
  /** Changes when the user edits the draft, so the log can tell "still ours" from "edited". */
  readonly messageId: string;
}

export interface LabelChange {
  readonly add: readonly string[];
  readonly remove: readonly string[];
}

/** One instance per inbox. Labels are names; `INBOX` is the inbox. */
export interface MailProvider {
  /** `cursor` null means "from the start". Returns ids of mail newer than the cursor. */
  listNew(
    cursor: string | null,
  ): Promise<{ readonly ids: readonly string[]; readonly cursor: string }>;
  getMessage(id: string): Promise<MailMessage>;
  ensureLabel(name: string): Promise<void>;
  modifyLabels(id: string, change: LabelChange): Promise<void>;
  archive(id: string): Promise<void>;
  createDraft(input: DraftInput): Promise<DraftInfo>;
  /** Null when the draft is gone. */
  getDraft(draftId: string): Promise<DraftInfo | null>;
  /** A missing draft is not an error. */
  deleteDraft(draftId: string): Promise<void>;
}

// U+0085, U+2028 and U+2029 are built from char codes: a literal one would split this line.
const LINE_BREAK = new RegExp("[\r\n" + String.fromCharCode(0x85, 0x2028, 0x2029) + "]");

/** Header-safe check shared by every provider. Throws `invalid`. */
export const assertDraftInput = (input: DraftInput): void => {
  if (LINE_BREAK.test(input.subject))
    throw new ProviderError("invalid", "subject has a line break");
  if (LINE_BREAK.test(input.to) || /[,;<>]/.test(input.to) || !input.to.includes("@"))
    throw new ProviderError("invalid", "recipient must be one plain address");
};
