import * as Schema from "effect/Schema";

import { NonNegativeInt, PositiveInt, ProjectId, TrimmedNonEmptyString } from "./baseSchemas.ts";

/** Most images one Generate press may queue per model. */
export const IMAGES_MAX_VARIATIONS = 12;
export const IMAGES_PROMPT_MAX_LENGTH = 4000;

/** Where an image engine lives. Slice 1 has one source: a ComfyUI server the user runs. */
export const ImageSourceId = Schema.Literals(["comfyui"]);
export type ImageSourceId = typeof ImageSourceId.Type;

/** "check" means the licence is not verified yet. The panel never claims "yes" for it. */
export const ImageCommercialUse = Schema.Literals(["yes", "no", "check"]);
export type ImageCommercialUse = typeof ImageCommercialUse.Type;

export const ImageModel = Schema.Struct({
  id: TrimmedNonEmptyString,
  sourceId: ImageSourceId,
  label: Schema.String,
  /** Disk size of the model files, in words, for example "7.8 GB". */
  sizeLabel: Schema.String,
  /** Typical time for one 1024 px image on a 12 GB card. */
  typicalSeconds: NonNegativeInt,
  licence: Schema.String,
  commercialUse: ImageCommercialUse,
});
export type ImageModel = typeof ImageModel.Type;

export const ImageItemStatus = Schema.Literals([
  "waiting",
  "running",
  "done",
  "error",
  "cancelled",
]);
export type ImageItemStatus = typeof ImageItemStatus.Type;

/** One image in the queue or the grid. */
export const ImageItem = Schema.Struct({
  id: TrimmedNonEmptyString,
  jobId: TrimmedNonEmptyString,
  prompt: Schema.String,
  modelId: Schema.String,
  modelLabel: Schema.String,
  seed: NonNegativeInt,
  status: ImageItemStatus,
  createdAt: NonNegativeInt,
  /** Set while the image runs. The panel counts the elapsed seconds from it. */
  startedAt: Schema.NullOr(NonNegativeInt),
  seconds: Schema.NullOr(Schema.Number),
  /** Path of the PNG, relative to the project folder. Null until the image is done. */
  file: Schema.NullOr(Schema.String),
  kept: Schema.Boolean,
  error: Schema.NullOr(Schema.String),
});
export type ImageItem = typeof ImageItem.Type;

export const ImageSourceStatus = Schema.Struct({
  sourceId: ImageSourceId,
  label: Schema.String,
  baseUrl: Schema.String,
  online: Schema.Boolean,
  /** True when ComfyUI did not answer in time while our own image runs. It is busy, not gone. */
  busy: Schema.Boolean,
  /** Plain words about the problem when the source is offline. */
  message: Schema.NullOr(Schema.String),
});
export type ImageSourceStatus = typeof ImageSourceStatus.Type;

export const ImagesState = Schema.Struct({
  source: ImageSourceStatus,
  models: Schema.Array(ImageModel),
  /** Newest first. */
  items: Schema.Array(ImageItem),
  /** Server clock when this state was made. The panel uses it to count elapsed seconds on any clock. */
  now: NonNegativeInt,
  /** Absolute project folder. The panel builds image addresses from it. */
  workspaceRoot: Schema.String,
  /** Folder for new images, relative to the project folder. */
  imagesFolder: Schema.String,
});
export type ImagesState = typeof ImagesState.Type;

export const ImagesSubscribeInput = Schema.Struct({ projectId: ProjectId });
export type ImagesSubscribeInput = typeof ImagesSubscribeInput.Type;

export const ImagesGenerateInput = Schema.Struct({
  projectId: ProjectId,
  prompt: TrimmedNonEmptyString.check(Schema.isMaxLength(IMAGES_PROMPT_MAX_LENGTH)),
  modelIds: Schema.Array(TrimmedNonEmptyString).check(Schema.isMinLength(1), Schema.isMaxLength(8)),
  /** First seed. Seed i is seed + i. Null or missing picks a random seed. */
  seed: Schema.optional(Schema.NullOr(NonNegativeInt)),
  count: PositiveInt.check(Schema.isLessThanOrEqualTo(IMAGES_MAX_VARIATIONS)),
});
export type ImagesGenerateInput = typeof ImagesGenerateInput.Type;

export const ImagesGenerateResult = Schema.Struct({
  jobId: Schema.String,
  queued: NonNegativeInt,
});
export type ImagesGenerateResult = typeof ImagesGenerateResult.Type;

export const ImagesCancelInput = Schema.Struct({
  /** True also stops the image that runs now. */
  stopRunning: Schema.Boolean,
});
export type ImagesCancelInput = typeof ImagesCancelInput.Type;

export const ImagesKeepInput = Schema.Struct({
  projectId: ProjectId,
  itemId: TrimmedNonEmptyString,
  kept: Schema.Boolean,
});
export type ImagesKeepInput = typeof ImagesKeepInput.Type;

export const ImagesRetryInput = Schema.Struct({
  projectId: ProjectId,
  itemId: TrimmedNonEmptyString,
});
export type ImagesRetryInput = typeof ImagesRetryInput.Type;

export const ImagesSetBaseUrlInput = Schema.Struct({
  baseUrl: TrimmedNonEmptyString.check(Schema.isMaxLength(300)),
});
export type ImagesSetBaseUrlInput = typeof ImagesSetBaseUrlInput.Type;

export class ImagesError extends Schema.TaggedError<ImagesError>()("ImagesError", {
  reason: Schema.Literals(["project_not_found", "invalid_input", "not_found", "storage"]),
  detail: Schema.optional(Schema.String),
}) {
  override get message(): string {
    return `Images failed (${this.reason})${this.detail ? `: ${this.detail}` : ""}.`;
  }
}
