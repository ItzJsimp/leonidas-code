import * as Schema from "effect/Schema";
import {
  CommandId,
  IsoDateTime,
  ProjectId,
  ScheduledTaskId,
  ThreadId,
  TrimmedNonEmptyString,
} from "./baseSchemas.ts";
import { ModelSelection } from "./modelSelection.ts";
import { RuntimeMode, ProviderInteractionMode } from "./providerPolicy.ts";
import { OrchestrationV2ThreadLaunchWorkspaceStrategy } from "./orchestrationV2.ts";

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
  launchedBy: Schema.optionalKey(Schema.NullOr(SavedItemCreator)),
  scheduledTaskId: Schema.optionalKey(Schema.NullOr(ScheduledTaskId)),
  boardTaskId: Schema.optionalKey(Schema.NullOr(TrimmedNonEmptyString)),
  pendingCommandId: Schema.optionalKey(Schema.NullOr(CommandId)),
  archivedFromStatus: Schema.optionalKey(
    Schema.NullOr(Schema.Literals(["queued", "launched", "done"])),
  ),
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

export const SavedItemCreateInput = Schema.Struct({
  commandId: CommandId,
  id: Schema.optional(SavedItemId),
  ...SavedItemExport.fields,
  body: SavedItem.fields.body,
  projectId: Schema.NullOr(ProjectId),
});
export type SavedItemCreateInput = typeof SavedItemCreateInput.Type;
export const SavedItemUpdateInput = Schema.Struct({
  commandId: CommandId,
  id: SavedItemId,
  kind: Schema.optional(SavedItemKind),
  title: Schema.optional(Schema.String),
  body: Schema.optional(SavedItem.fields.body),
  tags: Schema.optional(SavedItemExport.fields.tags),
  projectId: Schema.optional(Schema.NullOr(ProjectId)),
});
export type SavedItemUpdateInput = typeof SavedItemUpdateInput.Type;
export const SavedItemTransitionInput = Schema.Struct({
  commandId: CommandId,
  id: SavedItemId,
  action: Schema.Literals(["archive", "restore", "requeue", "done", "delete"]),
});
export type SavedItemTransitionInput = typeof SavedItemTransitionInput.Type;
export const SavedItemImportInput = Schema.Struct({
  commandId: CommandId,
  markdown: Schema.String.check(Schema.isMaxLength(110_000)),
  projectId: Schema.NullOr(ProjectId),
});
export type SavedItemImportInput = typeof SavedItemImportInput.Type;
export const SavedItemListInput = Schema.Struct({
  projectId: Schema.optional(Schema.NullOr(ProjectId)),
  status: Schema.optional(SavedItemStatus),
  kind: Schema.optional(SavedItemKind),
});
export type SavedItemListInput = typeof SavedItemListInput.Type;
/** The AIOS prompts folder the list mirrors; `present: false` lets the app offer setup. */
export const SavedItemPromptsFolder = Schema.Struct({
  path: Schema.NullOr(Schema.String),
  present: Schema.Boolean,
});
export type SavedItemPromptsFolder = typeof SavedItemPromptsFolder.Type;
export const SavedItemListResult = Schema.Struct({
  items: Schema.Array(SavedItem),
  promptsFolder: Schema.optionalKey(SavedItemPromptsFolder),
});
export type SavedItemListResult = typeof SavedItemListResult.Type;
export const SavedItemGetInput = Schema.Struct({ id: SavedItemId });
const executionFields = {
  commandId: CommandId,
  id: SavedItemId,
  projectId: Schema.optional(ProjectId),
  modelSelection: ModelSelection,
  runtimeMode: RuntimeMode,
  interactionMode: ProviderInteractionMode,
  workspaceStrategy: OrchestrationV2ThreadLaunchWorkspaceStrategy,
};
export const SavedItemLaunchInput = Schema.Struct(executionFields);
export type SavedItemLaunchInput = typeof SavedItemLaunchInput.Type;
export const SavedItemScheduleInput = Schema.Struct({
  ...executionFields,
  runAt: IsoDateTime.check(Schema.isPattern(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/)),
});
export type SavedItemScheduleInput = typeof SavedItemScheduleInput.Type;
export const SavedItemTaskInput = Schema.Struct({
  commandId: CommandId.check(Schema.isMaxLength(256)),
  id: SavedItemId,
});
export type SavedItemTaskInput = typeof SavedItemTaskInput.Type;
export class SavedItemError extends Schema.TaggedError<SavedItemError>()("SavedItemError", {
  reason: Schema.Literals([
    "not_found",
    "conflict",
    "invalid_input",
    "invalid_transition",
    "agent_limit",
    "storage",
    "execution",
  ]),
  cause: Schema.optional(Schema.Defect()),
}) {
  override get message(): string {
    switch (this.reason) {
      case "not_found":
        return "The saved item was not found.";
      case "conflict":
        return "The saved item or command already exists or has pending work.";
      case "invalid_input":
        return "The saved item request is invalid.";
      case "invalid_transition":
        return "The saved item cannot perform that action in its current state.";
      case "agent_limit":
        return "Agent saved-item execution is limited to ten requests per hour; launched agents cannot launch more saved items.";
      case "storage":
        return "Saved-item storage is unavailable.";
      case "execution":
        return "The saved-item action failed. Retry the same command to resume it.";
    }
  }
}
