import * as Schema from "effect/Schema";

/**
 * Content files: each contracted deal is a folder `deals/<deal>/` with `deal.md` and one file
 * per video, `NN-<slug>.md`. Files are the truth and Git is the history.
 * Agents draft scripts; only a person approves one.
 */

const NonBlank = Schema.String.check(
  Schema.makeFilter((value: string) => value.trim().length > 0, { expected: "a non-blank string" }),
);
export const ContentSlug = Schema.String.check(
  Schema.isPattern(/^[a-z0-9][a-z0-9-]{0,62}$/, { expected: "a lowercase slug" }),
);
/** A video file name without `.md`: two digits, a dash and a slug. */
export const ContentVideoFile = Schema.String.check(
  Schema.isPattern(/^\d{2}-[a-z0-9][a-z0-9-]{0,62}$/, { expected: "NN-<slug>" }),
);

export const CONTENT_STAGES = [
  "idea",
  "scripting",
  "script_review",
  "ready_to_film",
  "filmed",
  "cut_review",
  "revision_1",
  "revision_2",
  "delivered",
  "paid",
] as const;
export const ContentStage = Schema.Literals(CONTENT_STAGES);
export type ContentStage = typeof ContentStage.Type;

export const ContentActor = Schema.Struct({
  kind: Schema.Literals(["agent", "member"]),
  name: NonBlank,
});
export type ContentActor = typeof ContentActor.Type;

/**
 * The approval as the server checked it. `unsigned`: the file says approved, but no person
 * signed it. `content_changed`: the script changed after a person approved it.
 */
export const ContentApproval = Schema.Literals(["none", "approved", "unsigned", "content_changed"]);
export type ContentApproval = typeof ContentApproval.Type;

/** Why a draft passed or failed. The server counts words and rule hits; agents give the rest. */
export const ContentScorecard = Schema.Struct({
  hookScore: Schema.optional(Schema.Number),
  spokenSeconds: Schema.Number,
  targetSeconds: Schema.optional(Schema.Number),
  bannedWords: Schema.Array(Schema.String),
  doNotHits: Schema.Array(Schema.String),
  writerModel: Schema.optional(Schema.String),
  criticModel: Schema.optional(Schema.String),
  /** Blocks the move to script review: a banned word or a brand do-not. */
  blocks: Schema.Array(Schema.String),
  /** Shows on the card and does not block: a low hook score or a wrong length. */
  warnings: Schema.Array(Schema.String),
});
export type ContentScorecard = typeof ContentScorecard.Type;

export const ContentVideo = Schema.Struct({
  deal: ContentSlug,
  file: ContentVideoFile,
  id: Schema.String,
  title: NonBlank,
  /** The stage the lens uses. An unsigned approval reads as `script_review`. */
  stage: ContentStage,
  stageChanged: Schema.optional(Schema.String),
  pen: Schema.optional(Schema.String),
  approval: ContentApproval,
  approvedBy: Schema.optional(Schema.String),
  approvedAt: Schema.optional(Schema.String),
  revision: Schema.Number,
  hookType: Schema.optional(Schema.String),
  lengthS: Schema.optional(Schema.Number),
  due: Schema.optional(Schema.String),
  /** Google Drive file ids. */
  footage: Schema.Array(Schema.String),
  idea: Schema.String,
  script: Schema.String,
  shotList: Schema.String,
  notes: Schema.String,
  scorecard: ContentScorecard,
});
export type ContentVideo = typeof ContentVideo.Type;

export const ContentDeal = Schema.Struct({
  slug: ContentSlug,
  brand: NonBlank,
  stage: Schema.optional(Schema.String),
  driveFolderId: Schema.optional(Schema.String),
  productReceived: Schema.optional(Schema.String),
  brief: Schema.optional(Schema.String),
  /** Brand do-nots. A script that says one cannot go to script review. */
  doNot: Schema.Array(Schema.String),
  videos: Schema.Array(ContentVideo),
});
export type ContentDeal = typeof ContentDeal.Type;

/** A file the reader skipped, so one bad file never hides the rest. */
export const ContentBadRecord = Schema.Struct({ file: Schema.String, reason: Schema.String });
export type ContentBadRecord = typeof ContentBadRecord.Type;

/** The one error a screen shows in its own words: no AIOS folder is connected. */
export const CONTENT_NO_WORKSPACE = "No workspace is open.";

export class ContentRpcError extends Schema.TaggedError<ContentRpcError>()("ContentRpcError", {
  message: Schema.String,
}) {}

const WorkspaceRef = { workspaceId: Schema.optional(Schema.String) };
const VideoRef = { ...WorkspaceRef, deal: ContentSlug, file: ContentVideoFile };

export const ContentListInput = Schema.Struct(WorkspaceRef);
export type ContentListInput = typeof ContentListInput.Type;

export const ContentListResult = Schema.Struct({
  deals: Schema.Array(ContentDeal),
  bad: Schema.Array(ContentBadRecord),
});
export type ContentListResult = typeof ContentListResult.Type;

export const ContentHistoryInput = Schema.Struct(VideoRef);
export type ContentHistoryInput = typeof ContentHistoryInput.Type;

/** The latest agent draft, the "before" side. The video itself holds the script as it is now. */
export const ContentHistoryResult = Schema.Struct({
  baseline: Schema.NullOr(Schema.String),
  baselineCommit: Schema.NullOr(Schema.String),
});
export type ContentHistoryResult = typeof ContentHistoryResult.Type;

export const ContentMoveInput = Schema.Struct({
  ...VideoRef,
  to: ContentStage,
  note: Schema.optional(Schema.String.check(Schema.isMaxLength(2_000))),
});
export type ContentMoveInput = typeof ContentMoveInput.Type;

export const ContentSaveScriptInput = Schema.Struct({
  ...VideoRef,
  script: Schema.String.check(Schema.isMinLength(1), Schema.isMaxLength(20_000)),
});
export type ContentSaveScriptInput = typeof ContentSaveScriptInput.Type;

/** A saved video, and whether its Git commit went in. `detail` says why not. */
export const ContentWriteResult = Schema.Struct({
  video: ContentVideo,
  recorded: Schema.Boolean,
  detail: Schema.String,
});
export type ContentWriteResult = typeof ContentWriteResult.Type;

const Line = (max: number) => Schema.String.check(Schema.isMaxLength(max));

/** The New deal form. Only the brand is needed; the rest is checked by the server. */
export const ContentCreateDealInput = Schema.Struct({
  ...WorkspaceRef,
  brand: NonBlank.check(Schema.isMaxLength(120)),
  contact: Schema.optional(Line(200)),
  terms: Schema.optional(Line(5_000)),
  deadline: Schema.optional(Line(10)),
  driveFolder: Schema.optional(Line(300)),
  briefLink: Schema.optional(Line(500)),
});
export type ContentCreateDealInput = typeof ContentCreateDealInput.Type;

/** A saved deal, and whether its Git commit went in. `detail` says why not. */
export const ContentDealWriteResult = Schema.Struct({
  deal: ContentDeal,
  recorded: Schema.Boolean,
  detail: Schema.String,
});
export type ContentDealWriteResult = typeof ContentDealWriteResult.Type;
