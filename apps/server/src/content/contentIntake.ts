// @effect-diagnostics nodeBuiltinImport:off - content is plain files that people, scripts and Git also read.
import {
  CONTENT_INTAKES,
  type ContentActor,
  type ContentDeal,
  type ContentIntake,
  type ContentProposal,
} from "@t3tools/contracts";
import * as NodeFS from "node:fs";
import * as NodePath from "node:path";

import {
  ContentError,
  createDeal,
  dealDir,
  type DealInput,
  DEALS_DIR,
  dealFront,
  isSlug,
  LENS_DIR,
  normalizeDeal,
  oneLine,
  parseFile,
  sections,
} from "./contentFiles.ts";

/** Who may start a deal, from `deals/_lens/settings.json`. Anything unclear means `manual`. */
export function readIntake(root: string): ContentIntake {
  try {
    const mode: unknown = JSON.parse(
      NodeFS.readFileSync(NodePath.join(root, DEALS_DIR, LENS_DIR, "settings.json"), "utf8"),
    ).deal_intake;
    return CONTENT_INTAKES.find((known) => known === mode) ?? "manual";
  } catch {
    return "manual";
  }
}

export const proposalRel = (slug: string) => `${DEALS_DIR}/${LENS_DIR}/proposed/${slug}.md`;
const proposalPath = (root: string, slug: string) => NodePath.join(root, proposalRel(slug));

const text = (value: unknown) => (typeof value === "string" && value ? value : undefined);

function readProposal(root: string, slug: string): ContentProposal | null {
  try {
    const parsed = parseFile(NodeFS.readFileSync(proposalPath(root, slug), "utf8"));
    const brand = text(parsed?.front.brand);
    if (!parsed || !brand) return null;
    const optional = <K extends string>(key: K, value: string | undefined) =>
      value === undefined ? {} : { [key]: value };
    return {
      slug,
      brand,
      terms: sections(parsed.body).get("terms") ?? "",
      proposedBy: text(parsed.front.proposed_by) ?? "an agent",
      created: text(parsed.front.created) ?? "",
      ...optional("contact", text(parsed.front.contact)),
      ...optional("deadline", text(parsed.front.deadline)),
      ...optional("driveFolderId", text(parsed.front.drive_folder_id)),
      ...optional("briefLink", text(parsed.front.brief)),
      ...optional("source", text(parsed.front.source)),
    };
  } catch {
    return null;
  }
}

/** The proposed deals, in name order. An unreadable file is left out. */
export function listProposals(root: string): ReadonlyArray<ContentProposal> {
  const dir = NodePath.dirname(proposalPath(root, "x"));
  if (!NodeFS.existsSync(dir)) return [];
  return NodeFS.readdirSync(dir)
    .toSorted()
    .flatMap((name) => {
      const slug = name.endsWith(".md") ? name.slice(0, -3) : "";
      return isSlug(slug) ? (readProposal(root, slug) ?? []) : [];
    });
}

/** Waiting proposals an agent may leave. A person clears the list by confirming or dismissing. */
const MAX_PROPOSALS = 50;

export interface Proposed {
  readonly intake: ContentIntake;
  readonly proposal?: ContentProposal;
  readonly deal?: ContentDeal;
}

/**
 * An agent found a deal. `manual` refuses. `ask` and `propose` save a proposal for a person to
 * confirm. `auto` starts the deal at once. A proposal is never a deal.
 */
export function proposeDeal(
  root: string,
  key: Uint8Array,
  input: DealInput & { readonly source?: string | undefined },
  actor: ContentActor,
  now: string,
): Proposed {
  const intake = readIntake(root);
  if (intake === "manual") {
    throw new ContentError(
      "Deal intake is set to manual. A person starts a deal with the New deal button.",
    );
  }
  if (intake === "auto") return { intake, deal: createDeal(root, key, input, now) };
  const clean = normalizeDeal(input);
  if (NodeFS.existsSync(dealDir(root, clean.slug))) {
    throw new ContentError(`A deal for ${clean.slug} already exists.`);
  }
  if (listProposals(root).length >= MAX_PROPOSALS) {
    throw new ContentError(
      `There are ${MAX_PROPOSALS} proposed deals waiting. A person must confirm or dismiss some first.`,
    );
  }
  const source = oneLine(input.source);
  const front = [
    "type: deal_proposal",
    ...dealFront(clean),
    ...(source ? [`source: ${JSON.stringify(source)}`] : []),
    `proposed_by: ${JSON.stringify(actor.kind === "agent" ? actor.name : "a person")}`,
    `created: ${JSON.stringify(now.slice(0, 10))}`,
  ];
  NodeFS.mkdirSync(NodePath.dirname(proposalPath(root, clean.slug)), { recursive: true });
  try {
    // `wx` refuses to replace a proposal that is already there.
    NodeFS.writeFileSync(
      proposalPath(root, clean.slug),
      `---\n${front.join("\n")}\n---\n## Terms\n\n${clean.terms}\n`,
      { flag: "wx" },
    );
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "EEXIST") {
      throw new ContentError(`${clean.brand} is already proposed.`);
    }
    throw error;
  }
  const proposal = readProposal(root, clean.slug);
  if (!proposal) throw new ContentError("The proposal could not be read back.");
  return { intake, proposal };
}

export interface Decided {
  readonly deal?: ContentDeal;
  /** The files this answer changed, relative to the workspace, for one Git commit. */
  readonly paths: ReadonlyArray<string>;
}

/**
 * A person's answer. `confirm` starts the deal from the proposal and removes the proposal.
 * `dismiss` only removes it. A deal that cannot be made leaves the proposal where it is.
 */
export function decideProposal(
  root: string,
  key: Uint8Array,
  slug: string,
  decision: "confirm" | "dismiss",
  now: string,
): Decided {
  const proposal = isSlug(slug) ? readProposal(root, slug) : null;
  if (!proposal) throw new ContentError(`No proposed deal ${slug}.`);
  if (decision === "dismiss") {
    NodeFS.rmSync(proposalPath(root, slug));
    return { paths: [proposalRel(slug)] };
  }
  const deal = createDeal(
    root,
    key,
    {
      brand: proposal.brand,
      contact: proposal.contact,
      terms: proposal.terms,
      deadline: proposal.deadline,
      driveFolder: proposal.driveFolderId,
      briefLink: proposal.briefLink,
    },
    now,
  );
  NodeFS.rmSync(proposalPath(root, slug));
  return { deal, paths: [`${DEALS_DIR}/${deal.slug}/deal.md`, proposalRel(slug)] };
}
