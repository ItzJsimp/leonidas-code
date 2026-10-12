/**
 * Turns `git describe --tags --long` output into the label a dev copy shows, for example
 * `v0.12.0-17-gb5aae7f018` becomes `0.12.0+17` (the 0.12.0 release plus 17 newer changes).
 * Installed builds carry their exact release version, so only dev copies need this.
 */
export function formatDevVersionLabel(describe: string): string | null {
  const match = /^v?(\d+\.\d+\.\d+)-(\d+)-g[0-9a-f]+$/.exec(describe.trim());
  if (!match) return null;
  const [, release, ahead] = match;
  return ahead === "0" ? release! : `${release}+${ahead}`;
}
