export const SETTINGS_WINDOW_NAME = "leonidas-settings";
export const SETTINGS_DOCK_MESSAGE = "leonidas-settings-dock";

export function readSettingsDockHref(data: unknown, origin: string, applicationHref: string) {
  if (
    !data ||
    typeof data !== "object" ||
    !("type" in data) ||
    !("href" in data) ||
    data.type !== SETTINGS_DOCK_MESSAGE ||
    typeof data.href !== "string"
  )
    return null;
  try {
    const application = new URL(applicationHref);
    const target = new URL(data.href);
    if (
      origin !== application.origin ||
      target.protocol !== application.protocol ||
      target.host !== application.host ||
      !/^\/settings(\/|$)/.test(target.pathname)
    )
      return null;
    return `${target.pathname}${target.search}${target.hash}`;
  } catch {
    return null;
  }
}
