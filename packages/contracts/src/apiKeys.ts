import * as Schema from "effect/Schema";

import { TrimmedNonEmptyString } from "./baseSchemas.ts";

/** Ask the server to try one provider key. An empty `key` means: test the saved key. */
export const TestApiKeyInput = Schema.Struct({
  providerId: TrimmedNonEmptyString,
  key: Schema.optionalKey(Schema.String),
});
export type TestApiKeyInput = typeof TestApiKeyInput.Type;

export const TestApiKeyResult = Schema.Struct({
  ok: Schema.Boolean,
  /** Plain words for the user. Never contains the key. */
  message: Schema.String,
});
export type TestApiKeyResult = typeof TestApiKeyResult.Type;
