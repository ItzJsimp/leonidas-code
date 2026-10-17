import { PROVIDER_SEND_TURN_MAX_IMAGE_BYTES, type ScopedThreadRef } from "@t3tools/contracts";

import {
  type DraftId,
  type PersistedComposerImageAttachment,
  useComposerDraftStore,
} from "../../composerDraftStore";
import { compressImageToByteLimit } from "../../lib/imageCompression";
import { randomUUID } from "../../lib/utils";
import { readFileAsDataUrl } from "../ChatView.logic";

type SnipTarget = DraftId | ScopedThreadRef;

/**
 * Adds a snip to a draft that is not on screen, as the shortcut does. The open composer
 * attaches its own snips through the same attachment path as pasted images.
 */
export async function deliverSnipFile(file: File, target: SnipTarget): Promise<void> {
  const compressed = await compressImageToByteLimit(file, PROVIDER_SEND_TURN_MAX_IMAGE_BYTES);
  if (!compressed.ok) {
    throw new Error("The snip is too large to attach. Snip a smaller area.");
  }
  const attached = compressed.file;
  const dataUrl = await readFileAsDataUrl(attached);
  const id = randomUUID();
  const store = useComposerDraftStore.getState();
  const added = store.addImage(target, {
    type: "image",
    id,
    name: attached.name,
    mimeType: attached.type,
    sizeBytes: attached.size,
    previewUrl: dataUrl,
    file: attached,
  });
  if (!added) throw new Error("Remove an attachment, then snip again.");
  const persisted: PersistedComposerImageAttachment = {
    id,
    name: attached.name,
    mimeType: attached.type,
    sizeBytes: attached.size,
    dataUrl,
  };
  const existing = store.getComposerDraft(target)?.persistedAttachments ?? [];
  await store.syncPersistedAttachments(target, [
    ...existing.filter((attachment) => attachment.id !== id),
    persisted,
  ]);
}
