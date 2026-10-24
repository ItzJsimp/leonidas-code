/**
 * The Files page: every file the app keeps for chats. It reads the attachments folder (chat
 * attachments, uploads, rendered pages, preview screenshots) and joins each file to its chat.
 * Bytes are never returned here. A client asks the asset URL RPC for a preview or a download, so
 * the asset access checks stay the one door to the bytes.
 */
import {
  FilesError,
  type FilesDeleteInput,
  type FilesDeleteResult,
  type FilesListInput,
  type FilesListResult,
  type StoredFile,
  ThreadId,
} from "@t3tools/contracts";
import * as Clock from "effect/Clock";
import * as Context from "effect/Context";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Ref from "effect/Ref";
import * as SqlClient from "effect/sql/SqlClient";

import {
  parseThreadSegmentFromAttachmentId,
  resolveAttachmentPathById,
  toSafeThreadAttachmentSegment,
} from "../attachmentStore.ts";
import * as ServerConfig from "../config.ts";
import {
  encodeFileCursor,
  fallbackName,
  indexAfterCursor,
  isPendingSegment,
  kindOfExtension,
  matchesTab,
  parseStoredName,
  sortNewestFirst,
  type DiskFile,
} from "./attachmentArchive.logic.ts";

const DEFAULT_LIMIT = 48;
/** A search reads names chat by chat, so one call looks at no more than this many files. */
const SEARCH_SCAN_LIMIT = 3_000;
const NAME_CHUNK = 200;
const LISTING_TTL_MS = 10_000;
const LOOKUP_TTL_MS = 30_000;
const NAME_CACHE_MAX = 300;

interface Thread {
  readonly id: string;
  readonly title: string;
}

interface Listing {
  readonly at: number;
  readonly files: ReadonlyArray<DiskFile>;
  readonly counts: FilesListResult["counts"];
}

interface NameInfo {
  readonly name: string;
  readonly mimeType: string | undefined;
}

export class AttachmentArchive extends Context.Service<
  AttachmentArchive,
  {
    readonly list: (input: FilesListInput) => Effect.Effect<FilesListResult, FilesError>;
    /** Removes one file. A file that a live chat still holds stays and fails with `in_use`. */
    readonly remove: (input: FilesDeleteInput) => Effect.Effect<FilesDeleteResult, FilesError>;
  }
>()("t3/files/AttachmentArchive") {}

const make = Effect.gen(function* () {
  const fileSystem = yield* FileSystem.FileSystem;
  const config = yield* ServerConfig.ServerConfig;
  const sql = yield* SqlClient.SqlClient;
  const listingRef = yield* Ref.make<Listing | null>(null);
  const threadsRef = yield* Ref.make<{
    readonly at: number;
    readonly bySegment: ReadonlyMap<string, Thread>;
  } | null>(null);
  // Names per chat, newest use first. The map stays small: one entry per chat that a page showed.
  const names = new Map<
    string,
    { readonly at: number; readonly byId: ReadonlyMap<string, NameInfo> }
  >();

  const readListing = Effect.gen(function* () {
    const entries = yield* fileSystem.readDirectory(config.attachmentsDir);
    const found = yield* Effect.forEach(
      entries,
      (entry) => {
        const parsed = parseStoredName(entry);
        if (parsed === null) return Effect.succeed(null);
        return fileSystem.stat(`${config.attachmentsDir}/${entry}`).pipe(
          Effect.map((info): DiskFile | null =>
            info.type === "File"
              ? {
                  id: parsed.id,
                  extension: parsed.extension,
                  kind: kindOfExtension(parsed.extension),
                  sizeBytes: Number(info.size),
                  createdMs: Option.match(info.mtime, {
                    onNone: () => 0,
                    onSome: (date) => date.getTime(),
                  }),
                  segment: parsed.segment,
                }
              : null,
          ),
          // A file removed between the folder read and the stat is just skipped.
          Effect.orElseSucceed(() => null),
        );
      },
      { concurrency: 32 },
    );
    const files = sortNewestFirst(found.filter((file): file is DiskFile => file !== null));
    return {
      at: yield* Clock.currentTimeMillis,
      files,
      counts: {
        all: files.length,
        images: files.filter((file) => file.kind === "image").length,
        documents: files.filter((file) => file.kind !== "image").length,
      },
    } satisfies Listing;
  }).pipe(Effect.mapError((cause) => new FilesError({ reason: "read_failed", cause })));

  const listing = Effect.gen(function* () {
    const now = yield* Clock.currentTimeMillis;
    const cached = yield* Ref.get(listingRef);
    if (cached !== null && now - cached.at < LISTING_TTL_MS) return cached;
    const fresh = yield* readListing;
    yield* Ref.set(listingRef, fresh);
    return fresh;
  });

  const threadsBySegment = Effect.gen(function* () {
    const now = yield* Clock.currentTimeMillis;
    const cached = yield* Ref.get(threadsRef);
    if (cached !== null && now - cached.at < LOOKUP_TTL_MS) return cached.bySegment;
    const rows = yield* sql<{ readonly thread_id: string; readonly title: string }>`
      SELECT thread_id, title FROM orchestration_v2_projection_threads WHERE deleted_at IS NULL
    `;
    const bySegment = new Map<string, Thread>();
    for (const row of rows) {
      const segment = toSafeThreadAttachmentSegment(row.thread_id);
      if (segment !== null && !bySegment.has(segment)) {
        bySegment.set(segment, { id: row.thread_id, title: row.title });
      }
    }
    yield* Ref.set(threadsRef, { at: now, bySegment });
    return bySegment;
  }).pipe(Effect.mapError((cause) => new FilesError({ reason: "read_failed", cause })));

  /** The names that messages of one chat give to their attachments. */
  const namesOf = (threadId: string) =>
    Effect.gen(function* () {
      const now = yield* Clock.currentTimeMillis;
      const cached = names.get(threadId);
      if (cached !== undefined && now - cached.at < LOOKUP_TTL_MS) return cached.byId;
      const rows = yield* sql<{
        readonly id: string;
        readonly name: string | null;
        readonly mime: string | null;
      }>`
        SELECT json_extract(a.value, '$.id') AS id,
          json_extract(a.value, '$.name') AS name,
          json_extract(a.value, '$.mimeType') AS mime
        FROM orchestration_v2_projection_messages AS m,
          json_each(m.payload_json, '$.attachments') AS a
        WHERE m.thread_id = ${threadId}
      `;
      const byId = new Map<string, NameInfo>();
      for (const row of rows) {
        if (row.name) byId.set(row.id, { name: row.name, mimeType: row.mime ?? undefined });
      }
      if (names.size >= NAME_CACHE_MAX) names.delete(names.keys().next().value as string);
      names.set(threadId, { at: now, byId });
      return byId;
    }).pipe(Effect.mapError((cause) => new FilesError({ reason: "read_failed", cause })));

  /** Adds the name and chat to a run of files. */
  const describe = (files: ReadonlyArray<DiskFile>) =>
    Effect.gen(function* () {
      const bySegment = yield* threadsBySegment;
      const threadIds = new Set<string>();
      for (const file of files) {
        const thread = isPendingSegment(file.segment) ? undefined : bySegment.get(file.segment);
        if (thread) threadIds.add(thread.id);
      }
      const byThread = new Map(
        yield* Effect.forEach(
          [...threadIds],
          (id) => Effect.map(namesOf(id), (found) => [id, found] as const),
          { concurrency: 4 },
        ),
      );
      return files.map((file): StoredFile => {
        const thread = isPendingSegment(file.segment) ? undefined : bySegment.get(file.segment);
        const info = thread ? byThread.get(thread.id)?.get(file.id) : undefined;
        return {
          id: file.id,
          name: info?.name ?? fallbackName(file),
          kind: file.kind,
          ...(info?.mimeType === undefined ? {} : { mimeType: info.mimeType }),
          sizeBytes: file.sizeBytes,
          createdAt: DateTime.formatIso(DateTime.makeUnsafe(file.createdMs)),
          thread: thread ? { id: ThreadId.make(thread.id), title: thread.title } : null,
        };
      });
    });

  const list: AttachmentArchive["Service"]["list"] = (input) =>
    Effect.gen(function* () {
      const limit = input.limit ?? DEFAULT_LIMIT;
      const { files, counts } = yield* listing;
      const inTab = files.filter((file) => matchesTab(file.kind, input.tab));
      const start = indexAfterCursor(inTab, input.cursor);
      const query = input.query?.trim().toLowerCase() ?? "";
      if (query === "") {
        const slice = inTab.slice(start, start + limit);
        const last = slice.at(-1);
        return {
          files: yield* describe(slice),
          nextCursor:
            last !== undefined && start + limit < inTab.length ? encodeFileCursor(last) : null,
          counts,
        } satisfies FilesListResult;
      }
      // A search names files chat by chat, so it reads in chunks and stops at a full page.
      const matched: StoredFile[] = [];
      let position = start;
      const stop = Math.min(inTab.length, start + SEARCH_SCAN_LIMIT);
      let lastScanned: DiskFile | undefined;
      while (position < stop && matched.length < limit) {
        const chunk = inTab.slice(position, Math.min(position + NAME_CHUNK, stop));
        const described = yield* describe(chunk);
        for (const [index, file] of described.entries()) {
          if (matched.length >= limit) break;
          lastScanned = chunk[index];
          if (
            file.name.toLowerCase().includes(query) ||
            (file.thread?.title.toLowerCase().includes(query) ?? false)
          ) {
            matched.push(file);
          }
        }
        position += chunk.length;
      }
      const examined = lastScanned === undefined ? start : inTab.indexOf(lastScanned) + 1;
      return {
        files: matched,
        nextCursor:
          lastScanned !== undefined && examined < inTab.length
            ? encodeFileCursor(lastScanned)
            : null,
        counts,
      } satisfies FilesListResult;
    });

  const remove: AttachmentArchive["Service"]["remove"] = (input) =>
    Effect.gen(function* () {
      const path = resolveAttachmentPathById({
        attachmentsDir: config.attachmentsDir,
        attachmentId: input.attachmentId,
      });
      if (path === null) return yield* new FilesError({ reason: "not_found" });
      const segment = parseThreadSegmentFromAttachmentId(input.attachmentId) ?? "";
      const bySegment = yield* threadsBySegment;
      const owner = isPendingSegment(segment) ? undefined : bySegment.get(segment);
      if (owner !== undefined) {
        // A chat still shows the file when one of its messages or tool results names the id.
        const used = yield* sql<{ readonly found: number }>`
          SELECT EXISTS (
            SELECT 1 FROM orchestration_v2_projection_messages
              WHERE thread_id = ${owner.id} AND instr(payload_json, ${input.attachmentId}) > 0
          ) OR EXISTS (
            SELECT 1 FROM orchestration_v2_projection_turn_items
              WHERE thread_id = ${owner.id} AND type = 'dynamic_tool'
                AND instr(payload_json, ${input.attachmentId}) > 0
          ) AS found
        `.pipe(Effect.mapError((cause) => new FilesError({ reason: "read_failed", cause })));
        if (used[0]?.found === 1) {
          return yield* new FilesError({
            reason: "in_use",
            detail: `Chat "${owner.title}" still shows this file.`,
          });
        }
      }
      yield* fileSystem
        .remove(path, { force: true })
        .pipe(Effect.mapError((cause) => new FilesError({ reason: "delete_failed", cause })));
      yield* Ref.set(listingRef, null);
      return { deleted: true } satisfies FilesDeleteResult;
    });

  return AttachmentArchive.of({ list, remove });
});

export const layer = Layer.effect(AttachmentArchive, make);
