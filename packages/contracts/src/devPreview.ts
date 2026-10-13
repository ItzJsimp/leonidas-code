import * as Schema from "effect/Schema";
import { ProjectId } from "./baseSchemas.ts";

// A second, isolated copy of the project's app (its own profile and ports) that
// the user previews and picks elements from. Projects that ship
// `scripts/dev-isolated.ps1` use it; any other project with a `dev` or `start`
// package script is started with that script.
export const DevPreviewStatus = Schema.Literals(["stopped", "starting", "running", "failed"]);
export type DevPreviewStatus = typeof DevPreviewStatus.Type;

export const DevPreviewInput = Schema.Struct({ projectId: ProjectId });
export type DevPreviewInput = typeof DevPreviewInput.Type;

export const DevPreviewState = Schema.Struct({
  status: DevPreviewStatus,
  // Set once running. Carries the one-time pairing token the copy needs to sign in.
  url: Schema.NullOr(Schema.String),
  // Last useful log line while starting, or the failure reason.
  message: Schema.NullOr(Schema.String),
  // False when the project has no script to start a preview copy.
  supported: Schema.Boolean,
  // The command a generic project's server is started with, shown in the launch prompt.
  command: Schema.optional(Schema.NullOr(Schema.String)),
});
export type DevPreviewState = typeof DevPreviewState.Type;

export class DevPreviewError extends Schema.TaggedError<DevPreviewError>()("DevPreviewError", {
  reason: Schema.Literals(["project_not_found", "unsupported", "spawn_failed"]),
  cause: Schema.optional(Schema.Defect()),
}) {
  override get message(): string {
    return `Dev preview failed: ${this.reason}.`;
  }
}
