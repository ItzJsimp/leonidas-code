// @effect-diagnostics globalDate:off - each change is stamped with the wall-clock time.
import {
  CONTENT_NO_WORKSPACE,
  type ContentActor,
  type ContentCreateDealInput,
  type ContentDealWriteResult,
  type ContentHistoryInput,
  type ContentListResult,
  type ContentMoveInput,
  ContentRpcError,
  type ContentSaveScriptInput,
  type ContentVideo,
  type ContentWriteResult,
} from "@t3tools/contracts";
import * as Effect from "effect/Effect";

import { realGit } from "../areaSync/engine/git.ts";
import { contentApprovalKey } from "./approvalKey.ts";
import * as ContentFiles from "./contentFiles.ts";
import { recordChange, scriptHistory, videoRel } from "./contentGit.ts";

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
    return { deals: [...records], bad: [...bad] };
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
