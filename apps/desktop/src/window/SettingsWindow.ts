/** Only the app's settings pages may open a window with the desktop preload. */
export function isSettingsWindowRequest(applicationUrl: string, url: string, frameName: string) {
  try {
    const application = new URL(applicationUrl);
    const target = new URL(url);
    return (
      frameName === "leonidas-settings" &&
      target.protocol === application.protocol &&
      target.host === application.host &&
      /^\/settings(\/|$)/.test(target.pathname)
    );
  } catch {
    return false;
  }
}
import type { BrowserWindow, WebContents } from "electron";

export function installSettingsWindowSupport(
  window: BrowserWindow,
  applicationUrl: string,
  preload: string,
  displayName: string,
  openExternal: (url: string) => void,
) {
  const protectNavigation = (contents: WebContents) => {
    contents.on("will-navigate", (event, url) => {
      const application = new URL(applicationUrl);
      const target = new URL(url);
      if (target.protocol === application.protocol && target.host === application.host) return;
      event.preventDefault();
      openExternal(url);
    });
  };
  protectNavigation(window.webContents);
  window.webContents.setWindowOpenHandler(({ url, frameName }) => {
    if (!isSettingsWindowRequest(applicationUrl, url, frameName)) {
      openExternal(url);
      return { action: "deny" };
    }
    return {
      action: "allow",
      overrideBrowserWindowOptions: {
        width: 1100,
        height: 800,
        minWidth: 600,
        minHeight: 480,
        autoHideMenuBar: true,
        title: `${displayName} Settings`,
        webPreferences: { preload, contextIsolation: true, nodeIntegration: false, sandbox: true },
      },
    };
  });
  window.webContents.on("did-create-window", (popup) => {
    popup.webContents.setWindowOpenHandler(({ url }) => {
      openExternal(url);
      return { action: "deny" };
    });
    protectNavigation(popup.webContents);
    const closeSettingsWindow = () => {
      if (!popup.isDestroyed()) popup.close();
    };
    window.once("closed", closeSettingsWindow);
    popup.once("closed", () => window.removeListener("closed", closeSettingsWindow));
  });
}
