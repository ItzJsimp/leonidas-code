import { DesktopRecentSnip, DesktopSnipResult } from "@t3tools/contracts";
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";

import * as DesktopSnip from "../../snip/DesktopSnip.ts";
import * as IpcChannels from "../channels.ts";
import * as DesktopIpc from "../DesktopIpc.ts";
import { ensureTrustedSnapShotSender } from "./snapShot.ts";

export const startSnip = DesktopIpc.makeIpcMethod({
  channel: IpcChannels.START_SNIP_CHANNEL,
  payload: Schema.Void,
  result: DesktopSnipResult,
  handler: Effect.fn("desktop.ipc.snip.start")(function* (_, event) {
    yield* ensureTrustedSnapShotSender(event);
    return yield* (yield* DesktopSnip.DesktopSnip).start;
  }),
});

export const listRecentSnips = DesktopIpc.makeIpcMethod({
  channel: IpcChannels.LIST_RECENT_SNIPS_CHANNEL,
  payload: Schema.Void,
  result: Schema.Array(DesktopRecentSnip),
  handler: Effect.fn("desktop.ipc.snip.listRecent")(function* (_, event) {
    yield* ensureTrustedSnapShotSender(event);
    return yield* (yield* DesktopSnip.DesktopSnip).listRecent;
  }),
});

export const readSnip = DesktopIpc.makeIpcMethod({
  channel: IpcChannels.READ_SNIP_CHANNEL,
  payload: Schema.String,
  result: DesktopSnipResult,
  handler: Effect.fn("desktop.ipc.snip.read")(function* (path, event) {
    yield* ensureTrustedSnapShotSender(event);
    return yield* (yield* DesktopSnip.DesktopSnip).read(path);
  }),
});

export const openSnipsFolder = DesktopIpc.makeIpcMethod({
  channel: IpcChannels.OPEN_SNIPS_FOLDER_CHANNEL,
  payload: Schema.Void,
  result: Schema.Void,
  handler: Effect.fn("desktop.ipc.snip.openFolder")(function* (_, event) {
    yield* ensureTrustedSnapShotSender(event);
    yield* (yield* DesktopSnip.DesktopSnip).openFolder;
  }),
});
