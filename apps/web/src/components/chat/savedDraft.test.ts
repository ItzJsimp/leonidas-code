import { describe, expect, it, vi } from "vite-plus/test";
import { createDraftSaver } from "./savedDraft";
import { DraftId, useComposerDraftStore } from "../../composerDraftStore";

describe("saved composer drafts", () => {
  it("leaves a concurrently edited composer draft intact", async () => {
    const target = DraftId.make("save-concurrent-edit");
    const store = useComposerDraftStore.getState();
    store.setPrompt(target, "Original draft");
    const captured = store.getComposerDraft(target);
    let resolve!: () => void;
    const saver = createDraftSaver({
      create: () =>
        new Promise<void>((done) => {
          resolve = done;
        }),
      saveTask: vi.fn(),
    });
    const saving = saver.save(
      { key: target, body: captured!.prompt, kind: "prompt", projectId: null },
      () => useComposerDraftStore.getState().getComposerDraft(target) === captured,
      () => store.setPrompt(target, ""),
    );
    store.setPrompt(target, "Original draft plus new edits");
    resolve();
    await saving;
    expect(store.getComposerDraft(target)?.prompt).toBe("Original draft plus new edits");
  });
  it("clears only after persistence succeeds", async () => {
    let prompt = "Keep this prompt";
    let resolve!: () => void;
    const create = vi.fn(
      () =>
        new Promise<void>((done) => {
          resolve = done;
        }),
    );
    const saver = createDraftSaver({ create, saveTask: vi.fn() });
    const saving = saver.save(
      { key: "draft", body: prompt, kind: "prompt", projectId: null },
      () => prompt === "Keep this prompt",
      () => {
        prompt = "";
      },
    );
    expect(prompt).toBe("Keep this prompt");
    resolve();
    await saving;
    expect(prompt).toBe("");
  });

  it("preserves failures and retries the same durable identity", async () => {
    const create = vi.fn().mockRejectedValueOnce(new Error("offline")).mockResolvedValue(undefined);
    const clear = vi.fn();
    const saver = createDraftSaver({ create, saveTask: vi.fn() });
    const draft = { key: "draft", body: "Keep me", kind: "note" as const, projectId: null };
    await expect(saver.save(draft, () => true, clear)).rejects.toThrow("offline");
    expect(clear).not.toHaveBeenCalled();
    await saver.save(draft, () => true, clear);
    expect(create.mock.calls[0]).toEqual(create.mock.calls[1]);
    expect(create.mock.calls[1]?.[0].kind).toBe("note");
    expect(clear).toHaveBeenCalledOnce();
  });

  it("retains new edits and completes task conversion before clearing", async () => {
    const create = vi.fn().mockResolvedValue(undefined);
    const saveTask = vi
      .fn()
      .mockRejectedValueOnce(new Error("board unavailable"))
      .mockResolvedValue(undefined);
    const clear = vi.fn();
    const saver = createDraftSaver({ create, saveTask });
    const draft = { key: "draft", body: "A task", kind: "task" as const, projectId: null };
    await expect(saver.save(draft, () => true, clear)).rejects.toThrow("board unavailable");
    expect(clear).not.toHaveBeenCalled();
    await saver.save(draft, () => false, clear);
    expect(create).toHaveBeenCalledOnce();
    expect(saveTask.mock.calls[0]).toEqual(saveTask.mock.calls[1]);
    expect(clear).not.toHaveBeenCalled();
  });
});
