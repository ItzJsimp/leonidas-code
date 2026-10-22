import type { MailMessage } from "@t3tools/mail-autopilot";

import type { FetchLike } from "./gmailRequest.ts";
import { encodeWord } from "./gmailMime.ts";

interface SimMessage {
  id: string;
  threadId: string;
  labelIds: string[];
  snippet: string;
  headers: [string, string][];
  filenames: string[];
}
interface SimDraft {
  id: string;
  messageId: string;
  threadId: string;
  raw: string;
}

const SYSTEM = new Set(["INBOX", "SENT", "STARRED", "UNREAD", "DRAFT", "TRASH", "SPAM"]);
const b64url = (s: string) => Buffer.from(s, "utf8").toString("base64url");

/**
 * A small in-memory Gmail. It speaks the same JSON as the real API for the calls the adapter makes,
 * so the adapter can be tested without a network. Test-only.
 */
export class GmailSimulator {
  readonly requests: string[] = [];
  private messages: SimMessage[] = [];
  private labels = new Map<string, string>(); // id -> name
  private drafts = new Map<string, SimDraft>();
  private history: { id: number; messageIds: string[] }[] = [];
  private counter = 0;
  /** Test hook: reply to the next history call with 404, like an expired cursor. */
  expireHistory = false;
  /** Test hook: return this JSON for the next message get. */
  brokenMessageReply: unknown = undefined;

  constructor() {
    for (const name of SYSTEM) this.labels.set(name, name);
  }

  private labelId(name: string): string {
    for (const [id, n] of this.labels) if (n === name) return id;
    const id = `Label_${++this.counter}`;
    this.labels.set(id, name);
    return id;
  }

  seed(messages: readonly MailMessage[]): void {
    const ids: string[] = [];
    for (const m of messages) {
      const from = m.fromName ? `"${m.fromName}" <${m.fromAddress}>` : m.fromAddress;
      const headers: [string, string][] = [
        ["From", from],
        ["Subject", encodeWord(m.subject)],
      ];
      if (m.listUnsubscribe) headers.push(["List-Unsubscribe", "<mailto:unsub@example.test>"]);
      const labelIds = m.labels.map((n) => this.labelId(n));
      if (m.isOwn) labelIds.push("SENT");
      this.messages.push({
        id: m.id,
        threadId: m.threadId,
        labelIds,
        snippet: m.snippet,
        headers,
        filenames: [...m.attachmentNames],
      });
      if (m.ownRepliedInThread) {
        this.messages.push({
          id: `${m.id}-reply`,
          threadId: m.threadId,
          labelIds: ["SENT"],
          snippet: "",
          headers: [],
          filenames: [],
        });
      }
      ids.push(m.id);
    }
    this.history.push({ id: ++this.counter, messageIds: ids });
  }

  editDraft(draftId: string, body: string): void {
    const d = this.drafts.get(draftId);
    if (!d) return;
    const headEnd = Buffer.from(d.raw, "base64url").toString("utf8").split("\r\n\r\n")[0] ?? "";
    const next = `${headEnd}\r\n\r\n${Buffer.from(body, "utf8").toString("base64")}`;
    this.drafts.set(draftId, { ...d, raw: b64url(next), messageId: `gm${++this.counter}` });
  }

  /** Test hook: set this message's JSON to something broken. */
  breakNextMessage(value: unknown): void {
    this.brokenMessageReply = value;
  }

  readonly fetch: FetchLike = async (url, init) => {
    const u = new URL(url);
    const path = u.pathname.replace("/gmail/v1/users/me", "");
    this.requests.push(`${init.method} ${path}`);
    const ok = (value: unknown) => ({ status: 200, text: async () => JSON.stringify(value) });
    const status = (code: number) => ({ status: code, text: async () => "{}" });
    const body = init.body ? (JSON.parse(init.body) as Record<string, any>) : {};

    if (init.method === "GET" && path === "/profile")
      return ok({ historyId: String(this.counter) });
    if (init.method === "GET" && path === "/labels") {
      return ok({ labels: [...this.labels].map(([id, name]) => ({ id, name })) });
    }
    if (init.method === "POST" && path === "/labels") {
      if ([...this.labels.values()].includes(body.name)) return status(409);
      return ok({ id: this.labelId(body.name), name: body.name });
    }
    if (init.method === "GET" && path === "/messages") {
      const ids = this.messages
        .filter((m) => m.labelIds.includes("INBOX"))
        .map((m) => ({ id: m.id }));
      return ok({ messages: ids });
    }
    if (init.method === "GET" && path === "/history") {
      const start = u.searchParams.get("startHistoryId");
      if (this.expireHistory || start === "stale") {
        this.expireHistory = false;
        return status(404);
      }
      const events = this.history.filter((h) => h.id > Number(start));
      return ok({
        history: events.map((e) => ({
          id: String(e.id),
          messagesAdded: e.messageIds.map((id) => ({ message: { id } })),
        })),
        historyId: String(this.counter),
      });
    }
    let m = path.match(/^\/messages\/([^/]+)$/);
    if (m && init.method === "GET") {
      if (this.brokenMessageReply !== undefined) {
        const v = this.brokenMessageReply;
        this.brokenMessageReply = undefined;
        return ok(v);
      }
      const msg = this.messages.find((x) => x.id === m![1]);
      if (!msg) return status(404);
      return ok({
        id: msg.id,
        threadId: msg.threadId,
        labelIds: msg.labelIds,
        snippet: msg.snippet.replaceAll("'", "&#39;"),
        payload: {
          headers: msg.headers.map(([name, value]) => ({ name, value })),
          parts: msg.filenames.map((filename) => ({ filename, mimeType: "application/pdf" })),
        },
      });
    }
    m = path.match(/^\/messages\/([^/]+)\/modify$/);
    if (m && init.method === "POST") {
      const msg = this.messages.find((x) => x.id === m![1]);
      if (!msg) return status(404);
      const remove = new Set<string>(body.removeLabelIds ?? []);
      const add: string[] = body.addLabelIds ?? [];
      for (const id of [...remove, ...add]) if (!this.labels.has(id)) return status(400);
      msg.labelIds = [
        ...msg.labelIds.filter((l) => !remove.has(l)),
        ...add.filter((l) => !msg.labelIds.includes(l)),
      ];
      return ok({ id: msg.id, labelIds: msg.labelIds });
    }
    m = path.match(/^\/threads\/([^/]+)$/);
    if (m && init.method === "GET") {
      const inThread = this.messages.filter((x) => x.threadId === m![1]);
      if (inThread.length === 0) return status(404);
      return ok({ id: m[1], messages: inThread.map((x) => ({ id: x.id, labelIds: x.labelIds })) });
    }
    if (init.method === "POST" && path === "/drafts") {
      const id = `r${++this.counter}`;
      this.drafts.set(id, {
        id,
        messageId: `gm${++this.counter}`,
        threadId: body.message?.threadId ?? "",
        raw: body.message?.raw ?? "",
      });
      const d = this.drafts.get(id)!;
      return ok({ id, message: { id: d.messageId, threadId: d.threadId } });
    }
    m = path.match(/^\/drafts\/([^/]+)$/);
    if (m && init.method === "GET") {
      const d = this.drafts.get(m[1]!);
      if (!d) return status(404);
      const text = Buffer.from(d.raw, "base64url").toString("utf8");
      const [head = "", content = ""] = text.split("\r\n\r\n");
      const unfolded = head.replaceAll("\r\n ", " ");
      const headers = unfolded.split("\r\n").map((line) => {
        const i = line.indexOf(":");
        return { name: line.slice(0, i), value: line.slice(i + 1).trim() };
      });
      return ok({
        id: d.id,
        message: {
          id: d.messageId,
          threadId: d.threadId,
          payload: {
            headers,
            mimeType: "text/plain",
            body: {
              data: b64url(Buffer.from(content.replaceAll("\r\n", ""), "base64").toString("utf8")),
            },
          },
        },
      });
    }
    if (m && init.method === "DELETE") {
      if (!this.drafts.delete(m[1]!)) return status(404);
      return { status: 204, text: async () => "" };
    }
    return status(404);
  };
}
