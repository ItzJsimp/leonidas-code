import * as Schema from "effect/Schema";

// Laya onboarding install. "idle" means nothing started; the web step polls while "working".
export const LayaSetupResult = Schema.Struct({
  status: Schema.Literals(["idle", "working", "ready", "needs-python", "needs-packages", "error"]),
  message: Schema.String,
  missingPackages: Schema.Array(Schema.String),
});
export type LayaSetupResult = typeof LayaSetupResult.Type;

export const LayaSetupInput = Schema.Struct({
  action: Schema.Literals(["status", "install"]),
  installPackages: Schema.optional(Schema.Boolean),
});
export type LayaSetupInput = typeof LayaSetupInput.Type;
