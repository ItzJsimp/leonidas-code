import {
  LEONIDAS_REPLY_STYLE_SLUG,
  REPLY_STYLE_DIRECTORY,
  REPLY_STYLE_MAX_BODY_LENGTH,
  type ReplyStylePreset,
  type ReplyStyleProblem,
} from "@t3tools/contracts";

/** Plain words for each reason a style falls back to Leonidas. */
export const REPLY_STYLE_PROBLEM_TEXT: Record<ReplyStyleProblem, string> = {
  "bad-slug": "the file name is not allowed",
  missing: "the file is missing",
  unreadable: "the file cannot be read",
  empty: "the file has no instructions",
  "bad-frontmatter": "the name line at the top is missing or broken",
  "too-long": `the instructions are over ${REPLY_STYLE_MAX_BODY_LENGTH.toLocaleString("en-US")} characters`,
};

export interface ReplyStyleChip {
  /** The slug the chat asked for: chat choice, then project choice. */
  readonly selectedSlug: string;
  readonly source: "chat" | "project";
  /** What replies really use; Leonidas when the selected file is broken. */
  readonly activeSlug: string;
  readonly label: string;
  /** Set when the selected style falls back to Leonidas. */
  readonly problem: {
    readonly slug: string;
    readonly name: string;
    readonly reason: ReplyStyleProblem;
  } | null;
}

/**
 * The chip state, in the server's order: chat choice, then project choice. `presets` is null
 * while the list loads; the chip then trusts the selection and shows its slug.
 */
export function resolveReplyStyleChip(input: {
  readonly presets: ReadonlyArray<ReplyStylePreset> | null;
  readonly chatSlug: string | null;
  readonly projectSlug: string;
}): ReplyStyleChip {
  const selectedSlug = input.chatSlug ?? input.projectSlug;
  const source = input.chatSlug === null ? "project" : "chat";
  const preset = input.presets?.find((candidate) => candidate.slug === selectedSlug);
  const reason: ReplyStyleProblem | undefined =
    input.presets === null || selectedSlug === LEONIDAS_REPLY_STYLE_SLUG
      ? undefined
      : (preset?.problem ?? (preset ? undefined : "missing"));
  if (reason !== undefined) {
    return {
      selectedSlug,
      source,
      activeSlug: LEONIDAS_REPLY_STYLE_SLUG,
      label: "Leonidas",
      problem: { slug: selectedSlug, name: preset?.name || selectedSlug, reason },
    };
  }
  return {
    selectedSlug,
    source,
    activeSlug: selectedSlug,
    label: preset?.name || (selectedSlug === LEONIDAS_REPLY_STYLE_SLUG ? "Leonidas" : selectedSlug),
    problem: null,
  };
}

/** A file slug from a style name, unique among `taken`: "My style" -> "my-style", "my-style-2". */
export function replyStyleSlugFromName(name: string, taken: ReadonlyArray<string>): string {
  const base =
    name
      .toLowerCase()
      .replaceAll(/[^a-z0-9]+/g, "-")
      .replaceAll(/^-+|-+$/g, "")
      .slice(0, 56)
      .replace(/-+$/, "") || "style";
  const used = new Set([LEONIDAS_REPLY_STYLE_SLUG, ...taken]);
  if (!used.has(base)) return base;
  for (let index = 2; ; index += 1) {
    const candidate = `${base}-${index}`;
    if (!used.has(candidate)) return candidate;
  }
}

export function replyStyleRelativePath(slug: string): string {
  return `${REPLY_STYLE_DIRECTORY}/${slug}.md`;
}

/** Save is allowed with a name and a body inside the cap. */
export function replyStyleDraftProblem(draft: {
  readonly name: string;
  readonly body: string;
}): string | null {
  if (draft.name.trim() === "") return "Add a name.";
  if (draft.body.trim() === "") return "Add instructions.";
  if (draft.body.trim().length > REPLY_STYLE_MAX_BODY_LENGTH) {
    return `Instructions must be ${REPLY_STYLE_MAX_BODY_LENGTH.toLocaleString("en-US")} characters or fewer.`;
  }
  return null;
}
