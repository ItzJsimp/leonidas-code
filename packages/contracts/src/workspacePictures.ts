import * as Schema from "effect/Schema";

import { TrimmedNonEmptyString } from "./baseSchemas.ts";

// The profile picture of one AIOS workspace. The server keeps it in its own data folder, never in
// the AIOS, so every client (desktop, web, phone) sees the same picture.

/** Clients send a 256 px square; this leaves room for a PNG of that size and nothing more. */
export const WORKSPACE_PICTURE_MAX_BYTES = 256 * 1024;
export const WORKSPACE_PICTURE_MAX_SIDE = 1024;
export const WORKSPACE_PICTURE_SIDE = 256;

// Same rule as workspace.json ids, so a picture file name can never leave its folder.
export const WorkspacePictureWorkspaceId = TrimmedNonEmptyString.check(
  Schema.isPattern(/^[a-z0-9][a-z0-9-]{0,63}$/),
);

export const WorkspacePicturesListResult = Schema.Struct({
  /** Workspace id to a `data:` URL of its picture. Workspaces without a picture are absent. */
  pictures: Schema.Record(Schema.String, Schema.String),
});
export type WorkspacePicturesListResult = typeof WorkspacePicturesListResult.Type;

export const WorkspacePictureSetInput = Schema.Struct({
  workspaceId: WorkspacePictureWorkspaceId,
  // Base64 grows bytes by 4/3; the header adds a few dozen characters.
  dataUrl: TrimmedNonEmptyString.check(
    Schema.isMaxLength(Math.ceil((WORKSPACE_PICTURE_MAX_BYTES * 4) / 3) + 64),
  ),
});
export type WorkspacePictureSetInput = typeof WorkspacePictureSetInput.Type;

export const WorkspacePictureRemoveInput = Schema.Struct({
  workspaceId: WorkspacePictureWorkspaceId,
});
export type WorkspacePictureRemoveInput = typeof WorkspacePictureRemoveInput.Type;

export class WorkspacePictureError extends Schema.TaggedError<WorkspacePictureError>()(
  "WorkspacePictureError",
  { message: Schema.String },
) {}
