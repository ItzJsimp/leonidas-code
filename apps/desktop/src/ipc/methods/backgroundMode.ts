import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";

import * as DesktopAppSettings from "../../settings/DesktopAppSettings.ts";
import * as IpcChannels from "../channels.ts";
import { makeIpcMethod } from "../DesktopIpc.ts";

export const getBackgroundMode = makeIpcMethod({
  channel: IpcChannels.BACKGROUND_MODE_GET_CHANNEL,
  payload: Schema.Void,
  result: Schema.Boolean,
  handler: Effect.fn("desktop.ipc.backgroundMode.get")(function* () {
    const appSettings = yield* DesktopAppSettings.DesktopAppSettings;
    return (yield* appSettings.get).keepRunningInBackground;
  }),
});

export const setBackgroundMode = makeIpcMethod({
  channel: IpcChannels.BACKGROUND_MODE_SET_CHANNEL,
  payload: Schema.Boolean,
  result: Schema.Boolean,
  handler: Effect.fn("desktop.ipc.backgroundMode.set")(function* (enabled) {
    const appSettings = yield* DesktopAppSettings.DesktopAppSettings;
    yield* appSettings.setKeepRunningInBackground(enabled);
    return (yield* appSettings.get).keepRunningInBackground;
  }),
});
