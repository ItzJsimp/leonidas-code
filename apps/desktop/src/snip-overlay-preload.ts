import { contextBridge, ipcRenderer } from "electron";

import { SNIP_OVERLAY_EVENT_CHANNEL, SNIP_OVERLAY_VIEW_CHANNEL } from "./ipc/channels.ts";

// This preload belongs only to the snip overlay page. It forwards pointer events and receives the view.
contextBridge.exposeInMainWorld("snipOverlay", {
  send: (event: unknown) => ipcRenderer.send(SNIP_OVERLAY_EVENT_CHANNEL, event),
  onView: (listener: (view: unknown) => void) => {
    ipcRenderer.on(SNIP_OVERLAY_VIEW_CHANNEL, (_event, view: unknown) => listener(view));
  },
});
