const PREVIEW_EVENT = "leonidas:preview-whats-new";
const LATEST_RELEASE_URL = "https://api.github.com/repos/ItzJsimp/leonidas-code/releases/latest";
const SAMPLE_ITEMS = ["Sample bullet: this is what a shipped improvement looks like"];

/** Settings button -> coordinator: open the popup with the latest published release's bullets. */
export function requestWhatsNewPreview(): void {
  window.dispatchEvent(new Event(PREVIEW_EVENT));
}

export function onWhatsNewPreviewRequested(listener: () => void): () => void {
  window.addEventListener(PREVIEW_EVENT, listener);
  return () => window.removeEventListener(PREVIEW_EVENT, listener);
}

/** Markdown bullet lines of a release body, newest first (CI writes them oldest first). */
export function parseReleaseBullets(body: string): ReadonlyArray<string> {
  return body
    .split("\n")
    .filter((line) => /^\s*[-*]\s/.test(line))
    .map((line) => line.replace(/^\s*[-*]\s+/, "").trim())
    .slice(-8)
    .toReversed();
}

/** Bullets of the latest GitHub release, the same text the real update popup shows. */
export async function fetchLatestReleaseWhatsNew(): Promise<{
  version: string;
  items: ReadonlyArray<string>;
}> {
  try {
    const release = (await (await fetch(LATEST_RELEASE_URL)).json()) as {
      tag_name?: string;
      body?: string;
    };
    const items = parseReleaseBullets(release.body ?? "");
    return {
      version: (release.tag_name ?? "").replace(/^v/, ""),
      items: items.length > 0 ? items : SAMPLE_ITEMS,
    };
  } catch {
    return { version: "", items: SAMPLE_ITEMS };
  }
}
