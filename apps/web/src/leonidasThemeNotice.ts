export const LEONIDAS_THEME_NOTICE_STORAGE_KEY = "leonidas-code:theme-notice:v1";
export const THEME_PREFERENCE_STORAGE_KEY = "t3code:theme";

export function shouldShowLeonidasThemeNotice(input: {
  readonly alreadySeen: boolean;
  readonly storedTheme: string | null;
  readonly hasThemeHalves: boolean;
}): boolean {
  return (
    !input.alreadySeen &&
    (input.storedTheme === "system" ||
      input.storedTheme === "light" ||
      input.storedTheme === "dark") &&
    !input.hasThemeHalves
  );
}
