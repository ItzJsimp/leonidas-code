// @vitest-environment jsdom
import { scopeThreadRef } from "@t3tools/client-runtime/environment";
import { EnvironmentId, ThreadId } from "@t3tools/contracts";
import { beforeEach, expect, it } from "vite-plus/test";

import { useComposerDraftStore } from "../../composerDraftStore";
import { deliverSnipFile } from "./snipDelivery";

const target = scopeThreadRef(
  EnvironmentId.make("environment-local"),
  ThreadId.make("thread-snip"),
);
const PNG_BYTES = Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10]);

beforeEach(() => {
  useComposerDraftStore.getState().clearComposerContent(target);
});

it("adds the snip to the target draft as an image", async () => {
  await deliverSnipFile(new File([PNG_BYTES], "snip-1.png", { type: "image/png" }), target);
  const draft = useComposerDraftStore.getState().getComposerDraft(target);
  expect(draft?.images.map((image) => image.name)).toEqual(["snip-1.png"]);
  expect(draft?.persistedAttachments.map((attachment) => attachment.name)).toEqual(["snip-1.png"]);
});

it("keeps earlier attachments when a second snip arrives", async () => {
  await deliverSnipFile(new File([PNG_BYTES], "snip-1.png", { type: "image/png" }), target);
  await deliverSnipFile(new File([PNG_BYTES], "snip-2.png", { type: "image/png" }), target);
  const draft = useComposerDraftStore.getState().getComposerDraft(target);
  expect(draft?.images.map((image) => image.name)).toEqual(["snip-1.png", "snip-2.png"]);
  expect(draft?.persistedAttachments).toHaveLength(2);
});
