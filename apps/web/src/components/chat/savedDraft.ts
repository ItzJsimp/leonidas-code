import { randomUUID } from "../../lib/utils";
import {
  CommandId,
  SavedItemId,
  type ProjectId,
  type SavedItemCreateInput,
  type SavedItemTaskInput,
} from "@t3tools/contracts";

type DraftSave = {
  key: string;
  body: string;
  kind: "prompt" | "note" | "task";
  projectId: ProjectId | null;
};

/** Retain command identities across ambiguous failures; task conversion is a second durable step. */
export function createDraftSaver(commands: {
  create: (input: SavedItemCreateInput) => Promise<unknown>;
  saveTask: (input: SavedItemTaskInput) => Promise<unknown>;
}) {
  let intent:
    | { key: string; create: SavedItemCreateInput; task: SavedItemTaskInput; created: boolean }
    | undefined;
  let busy = false;
  return {
    async save(draft: DraftSave, unchanged: () => boolean, clear: () => void) {
      if (busy) throw new Error("The draft is still saving. Wait a moment.");
      if (!draft.body.trim()) throw new Error("Type something before you save.");
      if (draft.kind === "task" && draft.body.length > 20_000)
        throw new Error("A task can have up to 20,000 characters. Make it shorter.");
      const key = JSON.stringify(draft);
      if (intent?.key !== key) {
        const id = SavedItemId.make(randomUUID());
        intent = {
          key,
          create: {
            commandId: CommandId.make(randomUUID()),
            id,
            kind: draft.kind === "note" ? "note" : "prompt",
            title: draft.body.trim().split(/\r?\n/)[0]!.slice(0, 120),
            body: draft.body,
            tags: [],
            projectId: draft.projectId,
          },
          task: { commandId: CommandId.make(randomUUID()), id },
          created: false,
        };
      }
      busy = true;
      try {
        if (!intent.created) {
          await commands.create(intent.create);
          intent.created = true;
        }
        if (draft.kind === "task") await commands.saveTask(intent.task);
        if (unchanged()) clear();
        intent = undefined;
      } finally {
        busy = false;
      }
    },
  };
}
