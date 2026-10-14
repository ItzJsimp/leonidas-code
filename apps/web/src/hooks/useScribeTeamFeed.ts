import { useCallback, useEffect, useState } from "react";
import { useLiveRefresh } from "./useLiveRefresh";

export const SCRIBE_FEED_REPO = "ItzJsimp/leonidas-code";
export const SCRIBE_FEED_ISSUE = 2;
const SCRIBE_FEED_API_URL = `https://api.github.com/repos/${SCRIBE_FEED_REPO}/issues/${SCRIBE_FEED_ISSUE}/comments`;

export interface ScribeFeedItem {
  readonly id: string;
  readonly commentId: number;
  readonly author: string;
  readonly timestamp: string;
  readonly text: string;
  readonly app?: string;
  readonly latencyMs?: number;
  readonly createdAt: string;
  readonly htmlUrl: string;
}

export function parseScribeComment(comment: {
  readonly id: number;
  readonly body?: string | null;
  readonly created_at: string;
  readonly html_url: string;
  readonly user?: { readonly login?: string | null } | null;
}): ScribeFeedItem {
  const bodyText = comment.body?.trim() ?? "";
  try {
    const parsed = JSON.parse(bodyText);
    if (parsed && typeof parsed === "object" && typeof parsed.text === "string") {
      return {
        id: typeof parsed.id === "string" ? parsed.id : `comment-${comment.id}`,
        commentId: comment.id,
        author:
          typeof parsed.author === "string" && parsed.author.trim()
            ? parsed.author.trim()
            : (comment.user?.login ?? "Anonymous"),
        timestamp: typeof parsed.timestamp === "string" ? parsed.timestamp : comment.created_at,
        text: parsed.text,
        app: typeof parsed.app === "string" ? parsed.app : undefined,
        latencyMs: typeof parsed.latencyMs === "number" ? parsed.latencyMs : undefined,
        createdAt: comment.created_at,
        htmlUrl: comment.html_url,
      };
    }
  } catch {
    // Not valid JSON; fallback to plain body text
  }

  return {
    id: `comment-${comment.id}`,
    commentId: comment.id,
    author: comment.user?.login ?? "Anonymous",
    timestamp: comment.created_at,
    text: bodyText,
    createdAt: comment.created_at,
    htmlUrl: comment.html_url,
  };
}

export function buildGhBroadcastCommand(item: {
  readonly author: string;
  readonly text: string;
  readonly app?: string;
}): string {
  const payload = JSON.stringify({
    id: `tx_${Date.now().toString(36)}`,
    author: item.author,
    timestamp: new Date().toISOString(),
    text: item.text,
    app: item.app ?? "Leonidas Code",
  });
  return `gh issue comment ${SCRIBE_FEED_ISSUE} --repo ${SCRIBE_FEED_REPO} --body '${payload}'`;
}

export async function broadcastComment(
  item: { readonly author: string; readonly text: string; readonly app?: string },
  token?: string | null,
): Promise<{ readonly ok: boolean; readonly error?: string }> {
  const payload = {
    id: `tx_${Date.now().toString(36)}`,
    author: item.author,
    timestamp: new Date().toISOString(),
    text: item.text,
    app: item.app ?? "Leonidas Code",
  };

  if (!token) {
    return { ok: false, error: "No GitHub token configured" };
  }

  try {
    const response = await fetch(SCRIBE_FEED_API_URL, {
      method: "POST",
      headers: {
        Accept: "application/vnd.github.v3+json",
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ body: JSON.stringify(payload) }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return { ok: false, error: `GitHub API error ${response.status}: ${errorText}` };
    }

    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export function useScribeTeamFeed(options?: {
  readonly pollIntervalMs?: number;
  readonly enabled?: boolean;
}) {
  const { pollIntervalMs = 10_000, enabled = true } = options ?? {};
  const [items, setItems] = useState<ReadonlyArray<ScribeFeedItem>>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<number | null>(null);

  const fetchComments = useCallback(
    async (signal?: AbortSignal) => {
      if (!enabled) return;
      setLoading(true);
      try {
        const response = await fetch(
          SCRIBE_FEED_API_URL,
          signal
            ? {
                signal,
                headers: {
                  Accept: "application/vnd.github.v3+json",
                },
              }
            : {
                headers: {
                  Accept: "application/vnd.github.v3+json",
                },
              },
        );
        if (!response.ok) {
          throw new Error(`GitHub API returned status ${response.status}`);
        }
        const data = (await response.json()) as Array<{
          readonly id: number;
          readonly body?: string | null;
          readonly created_at: string;
          readonly html_url: string;
          readonly user?: { readonly login?: string | null } | null;
        }>;
        const parsedItems = data
          .map(parseScribeComment)
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        setItems(parsedItems);
        setError(null);
        setLastRefreshedAt(Date.now());
      } catch (err) {
        if (signal?.aborted) return;
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setLoading(false);
      }
    },
    [enabled],
  );

  useEffect(() => {
    const controller = new AbortController();
    void fetchComments(controller.signal);
    return () => controller.abort();
  }, [fetchComments]);

  useLiveRefresh(() => fetchComments(), {
    enabled,
    key: `scribe-team-feed:${SCRIBE_FEED_ISSUE}`,
    intervalMs: pollIntervalMs,
  });

  return {
    items,
    loading,
    error,
    lastRefreshedAt,
    refresh: () => fetchComments(),
  };
}
