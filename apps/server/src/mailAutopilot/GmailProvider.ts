import {
  ProviderError,
  type DraftInfo,
  type DraftInput,
  type LabelChange,
  type MailMessage,
  type MailProvider,
} from "@t3tools/mail-autopilot";

import { makeGmailRequest, type GmailRequestDeps } from "./gmailRequest.ts";
import { buildRawDraft, decodeWords, parseAddress } from "./gmailMime.ts";

const ME = "/gmail/v1/users/me";
const RECENT_QUERY = "in:inbox newer_than:7d";
const PAGE_SIZE = 100;
const MAX_PAGES = 5;
const MAX_LABEL_NAME = 225;

type Json = Record<string, unknown>;

const asObject = (value: unknown): Json => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new ProviderError("transient", "unexpected gmail reply");
  }
  return value as Json;
};
const asString = (value: unknown): string => {
  if (typeof value !== "string") throw new ProviderError("transient", "unexpected gmail reply");
  return value;
};
const asArray = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

const headerOf = (headers: unknown[], name: string): string | undefined => {
  for (const h of headers) {
    const o = asObject(h);
    if (typeof o.name === "string" && o.name.toLowerCase() === name.toLowerCase()) {
      return typeof o.value === "string" ? o.value : undefined;
    }
  }
  return undefined;
};

/** Gmail snippets arrive HTML-escaped. */
const unescapeSnippet = (s: string): string =>
  s
    .replaceAll("&#39;", "'")
    .replaceAll("&quot;", '"')
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&amp;", "&");

const filenamesOf = (part: unknown, out: string[] = []): string[] => {
  const o = asObject(part);
  if (typeof o.filename === "string" && o.filename !== "") out.push(o.filename);
  for (const child of asArray(o.parts)) filenamesOf(child, out);
  return out;
};

const draftText = (payload: Json): string => {
  const direct = asObject(payload.body ?? {}).data;
  if (typeof direct === "string") return Buffer.from(direct, "base64url").toString("utf8");
  for (const part of asArray(payload.parts)) {
    const p = asObject(part);
    if (p.mimeType === "text/plain") return draftText(p);
  }
  return "";
};

/** Gmail adapter. Reads mail, changes labels, and keeps drafts. It has no call that delivers mail. */
export const makeGmailProvider = (deps: GmailRequestDeps): MailProvider => {
  const request = makeGmailRequest(deps);
  const idByName = new Map<string, string>();
  const nameById = new Map<string, string>();

  const loadLabels = async () => {
    const reply = asObject(await request("GET", `${ME}/labels`));
    for (const l of asArray(reply.labels)) {
      const o = asObject(l);
      idByName.set(asString(o.name), asString(o.id));
      nameById.set(asString(o.id), asString(o.name));
    }
  };
  const idFor = async (name: string): Promise<string | undefined> => {
    if (!idByName.has(name)) await loadLabels();
    return idByName.get(name);
  };
  const namesFor = async (ids: string[]): Promise<string[]> => {
    if (ids.some((id) => !nameById.has(id))) await loadLabels();
    return ids.map((id) => nameById.get(id) ?? id);
  };

  const getMessage: MailProvider["getMessage"] = async (id) => {
    const m = asObject(
      await request("GET", `${ME}/messages/${encodeURIComponent(id)}?format=full`),
    );
    const payload = asObject(m.payload);
    const headers = asArray(payload.headers);
    const threadId = asString(m.threadId);
    const labelIds = asArray(m.labelIds).map(asString);
    const from = parseAddress(headerOf(headers, "From") ?? "");
    const thread = asObject(
      await request("GET", `${ME}/threads/${encodeURIComponent(threadId)}?format=minimal`),
    );
    const ownRepliedInThread = asArray(thread.messages).some((t) =>
      asArray(asObject(t).labelIds).includes("SENT"),
    );
    return {
      id: asString(m.id),
      threadId,
      fromName: from.name,
      fromAddress: from.address,
      subject: decodeWords(headerOf(headers, "Subject") ?? ""),
      snippet: unescapeSnippet(typeof m.snippet === "string" ? m.snippet : ""),
      attachmentNames: filenamesOf(payload),
      listUnsubscribe: headerOf(headers, "List-Unsubscribe") !== undefined,
      labels: await namesFor(labelIds),
      isOwn: labelIds.includes("SENT"),
      ownRepliedInThread,
    } satisfies MailMessage;
  };

  const recentInbox = async (): Promise<string[]> => {
    const ids: string[] = [];
    let pageToken = "";
    for (let page = 0; page < MAX_PAGES; page++) {
      const q = encodeURIComponent(RECENT_QUERY);
      const reply = asObject(
        await request("GET", `${ME}/messages?q=${q}&maxResults=${PAGE_SIZE}${pageToken}`),
      );
      for (const m of asArray(reply.messages)) ids.push(asString(asObject(m).id));
      if (typeof reply.nextPageToken !== "string") break;
      pageToken = `&pageToken=${encodeURIComponent(reply.nextPageToken)}`;
    }
    return ids;
  };

  const sinceHistory = async (cursor: string) => {
    const ids = new Set<string>();
    let latest = cursor;
    let pageToken = "";
    for (let page = 0; page < MAX_PAGES; page++) {
      const reply = asObject(
        await request(
          "GET",
          `${ME}/history?startHistoryId=${encodeURIComponent(cursor)}&historyTypes=messageAdded&labelId=INBOX${pageToken}`,
        ),
      );
      for (const h of asArray(reply.history)) {
        for (const added of asArray(asObject(h).messagesAdded)) {
          ids.add(asString(asObject(asObject(added).message).id));
        }
      }
      if (typeof reply.historyId === "string") latest = reply.historyId;
      if (typeof reply.nextPageToken !== "string") break;
      pageToken = `&pageToken=${encodeURIComponent(reply.nextPageToken)}`;
    }
    return { ids: [...ids], cursor: latest };
  };

  const listNew: MailProvider["listNew"] = async (cursor) => {
    // Read the cursor before the list, so mail that lands in between shows up next time.
    const profile = asObject(await request("GET", `${ME}/profile`));
    const fresh = asString(profile.historyId);
    if (cursor !== null) {
      try {
        return await sinceHistory(cursor);
      } catch (err) {
        if (!(err instanceof ProviderError) || err.code !== "not_found") throw err;
        // shortcut: an expired cursor re-reads the last 7 days of inbox, the log makes repeats harmless
      }
    }
    return { ids: await recentInbox(), cursor: fresh };
  };

  const ensureLabel: MailProvider["ensureLabel"] = async (name) => {
    const hasControl = [...name].some((c) => c.charCodeAt(0) < 0x20 || c.charCodeAt(0) === 0x7f);
    if (name === "" || name.length > MAX_LABEL_NAME || hasControl) {
      throw new ProviderError("invalid", "bad label name");
    }
    if (await idFor(name)) return;
    try {
      await request("POST", `${ME}/labels`, {
        name,
        labelListVisibility: "labelShow",
        messageListVisibility: "show",
      });
    } catch (err) {
      // Someone made it between our read and our write: that is fine.
      await loadLabels();
      if (!idByName.has(name)) throw err;
      return;
    }
    await loadLabels();
  };

  const labelIdsFor = async (names: readonly string[], create: boolean): Promise<string[]> => {
    const out: string[] = [];
    for (const name of names) {
      let id = await idFor(name);
      if (!id && create) {
        await ensureLabel(name);
        id = await idFor(name);
      }
      if (id) out.push(id);
      else if (create) throw new ProviderError("invalid", `unknown label ${name}`);
    }
    return out;
  };

  const modifyLabels: MailProvider["modifyLabels"] = async (id, change: LabelChange) => {
    const addLabelIds = await labelIdsFor(change.add, true);
    const removeLabelIds = await labelIdsFor(change.remove, false);
    await request("POST", `${ME}/messages/${encodeURIComponent(id)}/modify`, {
      addLabelIds,
      removeLabelIds,
    });
  };

  const readDraft = (reply: Json): DraftInfo => {
    const message = asObject(reply.message);
    const payload = asObject(message.payload);
    const headers = asArray(payload.headers);
    return {
      id: asString(reply.id),
      messageId: asString(message.id),
      threadId: asString(message.threadId),
      to: headerOf(headers, "To") ?? "",
      subject: decodeWords(headerOf(headers, "Subject") ?? ""),
      body: draftText(payload),
    };
  };

  return {
    listNew,
    getMessage,
    ensureLabel,
    modifyLabels,
    archive: (id) => modifyLabels(id, { add: [], remove: ["INBOX"] }),
    async createDraft(input: DraftInput) {
      const raw = buildRawDraft(input);
      const reply = asObject(
        await request("POST", `${ME}/drafts`, { message: { raw, threadId: input.threadId } }),
      );
      const message = asObject(reply.message);
      return { ...input, id: asString(reply.id), messageId: asString(message.id) };
    },
    async getDraft(draftId) {
      try {
        const reply = asObject(
          await request("GET", `${ME}/drafts/${encodeURIComponent(draftId)}?format=full`),
        );
        return readDraft(reply);
      } catch (err) {
        if (err instanceof ProviderError && err.code === "not_found") return null;
        throw err;
      }
    },
    async deleteDraft(draftId) {
      try {
        await request("DELETE", `${ME}/drafts/${encodeURIComponent(draftId)}`);
      } catch (err) {
        if (!(err instanceof ProviderError) || err.code !== "not_found") throw err;
      }
    },
  };
};
