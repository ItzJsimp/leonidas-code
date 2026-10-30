// @effect-diagnostics globalDate:off - each change is stamped with the wall-clock time.
import {
  CONTENT_NO_WORKSPACE,
  type ContentActor,
  type ContentCreateDealInput,
  type ContentDealWriteResult,
  type ContentDecideDealInput,
  type ContentDecideDealResult,
  type ContentHistoryInput,
  type ContentListResult,
  type ContentMoveInput,
  ContentRpcError,
  type ContentPairingAcceptInput,
  type ContentPairingAcceptResult,
  type ContentPairingCode,
  type ContentSaveScriptInput,
  type ContentSyncResult,
  type ContentVideo,
  type ContentWriteResult,
} from "@t3tools/contracts";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";

import { realGit } from "../areaSync/engine/git.ts";
import * as Secrets from "../auth/ServerSecretStore.ts";
import { syncArea } from "../areaSync/engine/sync.ts";
import { CONTENT_APPROVAL_KEY_NAME, contentApprovalKey } from "./approvalKey.ts";
import * as ContentFiles from "./contentFiles.ts";
import { recordChange, scriptHistory, videoRel } from "./contentGit.ts";
import { decideProposal, listProposals } from "./contentIntake.ts";
import { makePairing, openPairing } from "./contentPairing.ts";

const rpcError = (message: string) => new ContentRpcError({ message });

const failed = (error: unknown) =>
  rpcError(error instanceof ContentFiles.ContentError ? error.message : "Content files failed.");

const withRoot = <A, E>(
  resolveRoot: Effect.Effect<string | null, E>,
  work: (root: string, key: Uint8Array) => Promise<A>,
) =>
  Effect.gen(function* () {
    const root = yield* Effect.mapError(resolveRoot, () => rpcError(CONTENT_NO_WORKSPACE));
    if (root === null) return yield* rpcError(CONTENT_NO_WORKSPACE);
    const key = yield* Effect.mapError(contentApprovalKey, () =>
      rpcError("Could not read the key."),
    );
    return yield* Effect.tryPromise({ try: () => work(root, key), catch: failed });
  });

/**
 * The person at this computer, by the workspace's Git name: the same name their commits carry.
 * Only a signed-in session with filesystem:write reaches the calls that use it.
 */
async function member(root: string): Promise<ContentActor> {
  const name = await realGit(["config", "user.name"], root);
  return { kind: "member", name: name.code === 0 && name.out ? name.out : "A person" };
}

async function written(
  root: string,
  video: ContentVideo,
  actor: ContentActor,
  what: "script" | "stage",
): Promise<ContentWriteResult> {
  const ref = { actor, deal: video.deal, file: video.file };
  const { committed, detail } = await recordChange(
    root,
    videoRel(video.deal, video.file),
    what === "stage" ? { ...ref, what, to: video.stage } : { ...ref, what },
  );
  return { video, recorded: committed, detail };
}

/** Every folder deal and its videos, read once from the workspace files. */
export function list<E>(resolveRoot: Effect.Effect<string | null, E>) {
  return withRoot(resolveRoot, async (root, key): Promise<ContentListResult> => {
    const { records, bad } = ContentFiles.listDeals(root, key);
    return {
      deals: [...records],
      bad: [...bad],
      proposals: [...listProposals(root)],
    };
  });
}

export function history<E>(
  resolveRoot: Effect.Effect<string | null, E>,
  input: ContentHistoryInput,
) {
  return withRoot(resolveRoot, (root) => scriptHistory(root, input.deal, input.file));
}

/** A person moves a video. The caller's scope check is what keeps agents out. */
export function move<E>(resolveRoot: Effect.Effect<string | null, E>, input: ContentMoveInput) {
  return withRoot(resolveRoot, async (root, key) => {
    const actor = await member(root);
    const video = ContentFiles.moveStage(root, key, input, actor, new Date().toISOString());
    return written(root, video, actor, "stage");
  });
}

/** A person starts a deal by hand. The caller's scope check is what keeps agents out. */
export function createDeal<E>(
  resolveRoot: Effect.Effect<string | null, E>,
  input: ContentCreateDealInput,
) {
  return withRoot(resolveRoot, async (root, key): Promise<ContentDealWriteResult> => {
    const actor = await member(root);
    const deal = ContentFiles.createDeal(root, key, input, new Date().toISOString());
    const { committed, detail } = await recordChange(
      root,
      `${ContentFiles.DEALS_DIR}/${deal.slug}/deal.md`,
      { actor, what: "deal", deal: deal.slug },
    );
    return { deal, recorded: committed, detail };
  });
}

/** Codes this server already opened. shortcut: kept in memory, so a restart inside the 10 minutes forgets them. */
const usedCodes = new Set<string>();

/**
 * A person makes a pairing code from this computer's approval key. The caller's scope check is
 * what keeps agents out.
 */
export function pairingStart(): Effect.Effect<
  ContentPairingCode,
  ContentRpcError,
  Secrets.ServerSecretStore
> {
  return Effect.map(
    Effect.mapError(contentApprovalKey, () => rpcError("Could not read the key.")),
    (key) => {
      const { blob, pin, expiresAt } = makePairing(key, new Date().getTime());
      return { blob, pin, expiresAt: new Date(expiresAt).toISOString() };
    },
  );
}

/**
 * A person enters a code from another computer: this computer then signs and checks approvals
 * with that computer's key. Wrong, expired and used codes change nothing.
 */
export function pairingAccept(
  input: ContentPairingAcceptInput,
): Effect.Effect<ContentPairingAcceptResult, ContentRpcError, Secrets.ServerSecretStore> {
  const now = new Date().getTime();
  return Effect.gen(function* () {
    const opened = yield* Effect.try({
      try: () => openPairing(input.blob, input.pin, now),
      catch: failed,
    });
    if (usedCodes.has(opened.id)) return yield* rpcError("That code was used already.");
    const store = yield* Secrets.ServerSecretStore;
    const failure = () => rpcError("Could not save the key.");
    const current = yield* Effect.mapError(store.get(CONTENT_APPROVAL_KEY_NAME), failure);
    yield* Effect.mapError(store.set(CONTENT_APPROVAL_KEY_NAME, opened.key), failure);
    usedCodes.add(opened.id);
    return {
      replacedKey:
        Option.isNone(current) || !Buffer.from(current.value).equals(Buffer.from(opened.key)),
    };
  });
}

/** Files changed in the workspace that are not under `deals/`: saved or new. */
async function changesOutsideDeals(root: string): Promise<ReadonlyArray<string>> {
  const tracked = await realGit(["diff", "--name-only", "-z", "HEAD"], root);
  const fresh = await realGit(["ls-files", "--others", "--exclude-standard", "-z"], root);
  return [tracked, fresh]
    .flatMap((run) => (run.code === 0 ? run.out.split("\0") : []))
    .filter((path) => path !== "" && !path.startsWith(`${ContentFiles.DEALS_DIR}/`));
}

/**
 * A person shares the deal files: save, pull, push, through the area sync engine. That engine
 * saves every change in the folder, so Sync refuses when any file outside `deals/` changed.
 * The caller's scope check is what keeps agents out.
 */
export function sync<E>(resolveRoot: Effect.Effect<string | null, E>) {
  return withRoot(resolveRoot, async (root): Promise<ContentSyncResult> => {
    const others = await changesOutsideDeals(root);
    if (others.length > 0) {
      const more = others.length > 1 ? ` and ${others.length - 1} more` : "";
      throw new ContentFiles.ContentError(
        `Other files changed, so Sync did not run: ${others[0]}${more}. Sync shares deal files only. Save the other files first.`,
      );
    }
    const { state, detail, conflicts, committed } = await syncArea({ dir: root, git: realGit });
    return { state, detail, conflicts: [...conflicts], committed };
  });
}

/** A person confirms or dismisses a proposed deal. The caller's scope check keeps agents out. */
export function decideDeal<E>(
  resolveRoot: Effect.Effect<string | null, E>,
  input: ContentDecideDealInput,
) {
  return withRoot(resolveRoot, async (root, key): Promise<ContentDecideDealResult> => {
    const actor = await member(root);
    const { deal, paths } = decideProposal(
      root,
      key,
      input.slug,
      input.decision,
      new Date().toISOString(),
    );
    const { committed, detail } = await recordChange(
      root,
      paths,
      deal
        ? { actor, what: "deal", deal: deal.slug }
        : { actor, what: "proposal", deal: input.slug, outcome: "dismissed" },
    );
    return { ...(deal ? { deal } : {}), recorded: committed, detail };
  });
}

/** A person edits a script. The caller's scope check is what keeps agents out. */
export function saveScript<E>(
  resolveRoot: Effect.Effect<string | null, E>,
  input: ContentSaveScriptInput,
) {
  return withRoot(resolveRoot, async (root, key) => {
    const actor = await member(root);
    const video = ContentFiles.saveScript(root, key, input, actor, new Date().toISOString());
    return written(root, video, actor, "script");
  });
}
