import type { DesktopRecentSnip, DesktopSnipResult } from "@t3tools/contracts";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Schema from "effect/Schema";

const DesktopSnipOperation = Schema.Literals([
  "unsupported",
  "capture",
  "save",
  "list",
  "read",
  "open-folder",
]);

export class DesktopSnipError extends Schema.TaggedError<DesktopSnipError>()("DesktopSnipError", {
  operation: DesktopSnipOperation,
  cause: Schema.optional(Schema.Defect()),
}) {
  override get message(): string {
    switch (this.operation) {
      case "unsupported":
        return "Snipping is not available on this computer yet.";
      case "capture":
        return "Could not capture the screen.";
      case "save":
        return "Could not save the snip.";
      case "list":
        return "Could not list your recent snips.";
      case "read":
        return "Could not open that snip.";
      case "open-folder":
        return "Could not open the snips folder.";
    }
  }
}

export class DesktopSnip extends Context.Service<
  DesktopSnip,
  {
    /** Freeze the screen, let the user pick a window or region, save it, and return it. */
    readonly start: Effect.Effect<DesktopSnipResult, DesktopSnipError>;
    readonly listRecent: Effect.Effect<ReadonlyArray<DesktopRecentSnip>, DesktopSnipError>;
    readonly read: (path: string) => Effect.Effect<DesktopSnipResult, DesktopSnipError>;
    readonly openFolder: Effect.Effect<void, DesktopSnipError>;
  }
>()("@t3tools/desktop/snip/DesktopSnip") {}

/** Placeholder until the overlay slice lands: every snip is cancelled and the list is empty. */
export const layer = Layer.succeed(DesktopSnip, {
  start: Effect.succeed({ status: "cancelled" as const }),
  listRecent: Effect.succeed([]),
  read: () => Effect.fail(new DesktopSnipError({ operation: "read" })),
  openFolder: Effect.void,
});
