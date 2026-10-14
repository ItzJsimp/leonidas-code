import type { ChatAttachment, ChatFileAttachment } from "@t3tools/contracts";

import type { ExpandedImagePreview } from "./ExpandedImagePreview";

/** What the composer may attach, plus the attachment actions the chat view owns. */
export interface ComposerAttachmentSlice {
  readonly uploadsCapabilityKnown: boolean;
  readonly supportsUploads: boolean;
  readonly supportsQuestionAttachments: boolean;
  readonly maxFileBytes: number | null;
  /**
   * Queued-message edit mode: attachments already stored on the message being
   * edited. Rendered in the attachment strip with a remove control; removal is
   * client state in ChatView until the edit is saved.
   */
  readonly editingQueued: ReadonlyArray<{
    readonly attachment: ChatAttachment;
    readonly url: string | null;
  }> | null;
  readonly onRemoveEditingQueued: (attachmentId: string) => void;
  readonly onExpandImage: (preview: ExpandedImagePreview) => void;
  readonly onFileOpen: (attachment: ChatFileAttachment) => void;
}
