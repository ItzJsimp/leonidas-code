import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";
import { ModelSelection } from "./modelSelection.ts";

export const DEFAULT_VOICE_LOG_SKIP_APPS = [
  "1password",
  "bitwarden",
  "keepass",
  "dashlane",
  "bank",
  "chase",
  "wellsfargo",
];
export const VoiceLogMemorySettings = Schema.Struct({
  enabled: Schema.Boolean.pipe(Schema.withDecodingDefault(Effect.succeed(false))),
  skipApps: Schema.Array(Schema.String.check(Schema.isMinLength(1), Schema.isMaxLength(120)))
    .check(Schema.isMaxLength(100))
    .pipe(Schema.withDecodingDefault(Effect.succeed(DEFAULT_VOICE_LOG_SKIP_APPS))),
});
export const VoiceLogDraft = Schema.Struct({
  id: Schema.String,
  day: Schema.String,
  lines: Schema.Array(Schema.String.check(Schema.isMaxLength(500))).check(Schema.isMaxLength(20)),
  modelSelection: ModelSelection,
  providerLabel: Schema.String,
  reason: Schema.String,
});
export type VoiceLogDraft = typeof VoiceLogDraft.Type;
export const VoiceLogMemoryReview = Schema.Struct({
  enabled: Schema.Boolean,
  canApprove: Schema.Boolean,
  draft: Schema.NullOr(VoiceLogDraft),
  problem: Schema.NullOr(Schema.String),
});
export type VoiceLogMemoryReview = typeof VoiceLogMemoryReview.Type;
export const VoiceLogMemoryApproveInput = Schema.Struct({
  draftId: Schema.String.check(Schema.isMinLength(1)),
  selected: Schema.Array(Schema.Int.check(Schema.isBetween({ minimum: 0, maximum: 19 }))).check(
    Schema.isMaxLength(20),
  ),
});
export type VoiceLogMemoryApproveInput = typeof VoiceLogMemoryApproveInput.Type;
export class VoiceLogMemoryError extends Schema.TaggedError<VoiceLogMemoryError>()(
  "VoiceLogMemoryError",
  { message: Schema.String },
) {}
