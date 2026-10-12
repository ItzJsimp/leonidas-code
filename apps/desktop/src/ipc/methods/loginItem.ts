import * as Electron from "electron";
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";

import * as IpcChannels from "../channels.ts";
import { makeIpcMethod } from "../DesktopIpc.ts";

const LoginItemState = Schema.Struct({
  // Only an installed build can register itself; a dev run would register the Electron binary.
  supported: Schema.Boolean,
  openAtLogin: Schema.Boolean,
});

const readState = (): typeof LoginItemState.Type => {
  const supported = Electron.app.isPackaged && process.platform !== "linux";
  return {
    supported,
    openAtLogin: supported && Electron.app.getLoginItemSettings().openAtLogin,
  };
};

export const getLoginItemState = makeIpcMethod({
  channel: IpcChannels.LOGIN_ITEM_GET_STATE_CHANNEL,
  payload: Schema.Void,
  result: LoginItemState,
  handler: () => Effect.sync(readState),
});

export const setLoginItemOpenAtLogin = makeIpcMethod({
  channel: IpcChannels.LOGIN_ITEM_SET_CHANNEL,
  payload: Schema.Boolean,
  result: LoginItemState,
  handler: (openAtLogin) =>
    Effect.sync(() => {
      if (readState().supported) Electron.app.setLoginItemSettings({ openAtLogin });
      return readState();
    }),
});
