import * as Schema from "effect/Schema";
import { IsoDateTime, ProjectId, ThreadId, TrimmedNonEmptyString } from "./baseSchemas.ts";

/**
 * Task saves are not a kind: saving a draft as a task creates a board task and the item moves to
 * the board, so only prompts and notes persist as saved items.
 */
export const SavedItemKind = Schema.Literals(["prompt", "note"]);
export type SavedItemKind = typeof SavedItemKind.Type;

export const SavedItemStatus = Schema.Literals(["queued", "launched", "done", "archived"]);
export type SavedItemStatus = typeof SavedItemStatus.Type;

export const SavedItemId = TrimmedNonEmptyString.pipe(Schema.brand("SavedItemId"));
export type SavedItemId = typeof SavedItemId.Type;

export const SavedItemCreator = Schema.Literals(["user", "agent"]);
export type SavedItemCreator = typeof SavedItemCreator.Type;

export const SAVED_ITEM_BODY_MAX_LENGTH = 100_000;

export const SavedItem = Schema.Struct({
  id: SavedItemId,
  kind: SavedItemKind,
  title: Schema.String,
  body: Schema.String.check(Schema.isMaxLength(SAVED_ITEM_BODY_MAX_LENGTH)),
  tags: Schema.Array(TrimmedNonEmptyString),
  /** Null is the "no project" bucket for ideas that fit nowhere yet. */
  projectId: Schema.NullOr(ProjectId),
  status: SavedItemStatus,
  /** Set when the item was launched into a thread, kept so a launched item can be traced and re-queued. */
  launchedThreadId: Schema.NullOr(ThreadId),
  createdBy: SavedItemCreator,
  createdAt: IsoDateTime,
  updatedAt: IsoDateTime,
});
export type SavedItem = typeof SavedItem.Type;

/** The fields that travel in exported markdown; ids, status and ownership stay in the receiving instance. */
export const SavedItemExport = Schema.Struct({
  kind: SavedItemKind,
  title: Schema.String,
  tags: Schema.Array(TrimmedNonEmptyString),
  body: Schema.String,
});
export type SavedItemExport = typeof SavedItemExport.Type;
