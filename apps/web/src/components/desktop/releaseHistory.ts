const RELEASES_URL = "https://api.github.com/repos/ItzJsimp/leonidas-code/releases";

export interface ReleaseHistoryEntry {
  readonly version: string;
  readonly publishedAt: string;
  readonly notes: ReadonlyArray<string>;
  readonly url: string;
}

export function parseReleaseHistory(value: unknown): ReleaseHistoryEntry[] {
  if (!Array.isArray(value)) throw new Error("Invalid release history response");
  return value.flatMap((release: unknown) => {
    if (typeof release !== "object" || release === null) return [];
    const row = release as Record<string, unknown>;
    if (
      row.draft ||
      row.prerelease ||
      typeof row.tag_name !== "string" ||
      !/^v\d+\.\d+\.\d+$/.test(row.tag_name)
    )
      return [];
    const notes =
      typeof row.body === "string"
        ? row.body
            .split("\n")
            .filter((line) => /^\s*[-*]\s/.test(line))
            .map((line) => line.replace(/^\s*[-*]\s+/, "").trim())
        : [];
    return [
      {
        version: row.tag_name.slice(1),
        publishedAt: typeof row.published_at === "string" ? row.published_at : "",
        notes: [...new Set(notes)],
        url:
          typeof row.html_url === "string" &&
          row.html_url.startsWith("https://github.com/ItzJsimp/leonidas-code/releases/")
            ? row.html_url
            : "",
      },
    ];
  });
}

export async function fetchReleaseHistory(
  page: number,
  signal?: AbortSignal,
): Promise<{
  entries: ReleaseHistoryEntry[];
  hasMore: boolean;
}> {
  const response = await fetch(`${RELEASES_URL}?per_page=10&page=${page}`, {
    signal: signal ?? null,
  });
  if (!response.ok)
    throw new Error(
      response.status === 403 || response.status === 429
        ? "GitHub temporarily limited requests. Please try again later."
        : "Could not load release history. Please try again.",
    );
  const value: unknown = await response.json();
  return {
    entries: parseReleaseHistory(value),
    hasMore: Array.isArray(value) && value.length === 10,
  };
}
