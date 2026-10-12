import { useAtomValue } from "@effect/atom-react";
import { useNavigate } from "@tanstack/react-router";
import { BookmarkPlusIcon, ChevronDownIcon } from "lucide-react";
import { useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  CommandId,
  type EnvironmentId,
  type ModelSelection,
  type ProjectId,
  type ProviderInteractionMode,
  type RuntimeMode,
  type SavedItem,
  type SavedItemStatus,
} from "@t3tools/contracts";
import {
  type AtomCommandResult,
  squashAtomCommandFailure,
} from "@t3tools/client-runtime/state/runtime";
import { parseSavedItemMarkdown, renderSavedItemMarkdown } from "@t3tools/shared/savedItemMarkdown";
import {
  useComposerDraftStore,
  composerTargetKey,
  type ComposerThreadTarget,
} from "../../composerDraftStore";
import { useEnvironmentQuery } from "../../state/query";
import { serverEnvironment } from "../../state/server";
import { useAtomCommand } from "../../state/use-atom-command";
import { Button } from "../ui/button";
import { Menu, MenuItem, MenuPopup, MenuTrigger } from "../ui/menu";
import { Sheet, SheetDescription, SheetHeader, SheetPopup, SheetTitle } from "../ui/sheet";
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPopup,
  DialogTitle,
} from "../ui/dialog";
import { Input } from "../ui/input";
import { Textarea } from "../ui/textarea";
import { randomUUID } from "../../lib/utils";
import { ComposerBanner } from "./ComposerBanner";
import { createDraftSaver } from "./savedDraft";

type Props = {
  environmentId: EnvironmentId;
  projectId: ProjectId | null;
  target: ComposerThreadTarget;
  modelSelection: ModelSelection;
  runtimeMode: RuntimeMode;
  interactionMode: ProviderInteractionMode;
  canSave: boolean;
};

function unwrap<A, E>(result: AtomCommandResult<A, E>): A {
  if (result._tag === "Failure") throw squashAtomCommandFailure(result);
  return result.value;
}
function errorText(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

/** Server-backed saves are separate from the composer's local attachment-capable stash. */
export function ComposerSavedItems(props: Props) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const targetRef = useRef(props.target);
  useLayoutEffect(() => {
    targetRef.current = props.target;
  }, [props.target]);
  const draft = useComposerDraftStore((state) => state.getComposerDraft(props.target));
  const canOperate = useAtomValue(
    serverEnvironment.createSavedItem.permissionAtom(props.environmentId),
  );
  const create = useAtomCommand(serverEnvironment.createSavedItem);
  const task = useAtomCommand(serverEnvironment.saveSavedItemAsTask);
  const saver = useMemo(
    () =>
      createDraftSaver({
        create: async (input) =>
          unwrap(await create({ environmentId: props.environmentId, input })),
        saveTask: async (input) =>
          unwrap(await task({ environmentId: props.environmentId, input })),
      }),
    [create, task, props.environmentId],
  );
  const hasContext =
    !!draft &&
    [
      draft.images,
      draft.files,
      draft.persistedAttachments,
      draft.terminalContexts,
      draft.previewAnnotations,
      draft.reviewComments,
      draft.threadContexts,
    ].some((items) => items.length > 0);
  const disabled = !canOperate || !props.canSave || busy || !draft?.prompt.trim() || hasContext;
  const save = async (kind: "prompt" | "note" | "task") => {
    if (disabled || !draft) return;
    const captured = draft;
    const target = props.target;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await saver.save(
        { key: composerTargetKey(target), body: captured.prompt, kind, projectId: props.projectId },
        () =>
          composerTargetKey(targetRef.current) === composerTargetKey(target) &&
          useComposerDraftStore.getState().getComposerDraft(target) === captured,
        () => useComposerDraftStore.getState().setPrompt(target, ""),
      );
      setNotice(kind === "task" ? "Saved to Tasks" : `Saved as ${kind}`);
    } catch (cause) {
      setError(errorText(cause));
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <ComposerBanner.Root density="comfortable" width="content" data-tour="saved-items">
        <div className="flex items-center gap-1">
          <Button
            size="xs"
            variant="ghost"
            onClick={() => setOpen(true)}
            aria-label="Open Saved items"
          >
            <BookmarkPlusIcon />
            Saved
          </Button>
          {draft?.prompt.trim() ? (
            <div className="flex items-center">
              <Button
                size="xs"
                variant="ghost"
                disabled={disabled}
                onClick={() => void save("prompt")}
              >
                {busy ? "Saving…" : "Save"}
              </Button>
              <Menu>
                <MenuTrigger
                  render={
                    <Button
                      size="icon-xs"
                      variant="ghost"
                      disabled={disabled}
                      aria-label="Choose saved item kind"
                    />
                  }
                >
                  <ChevronDownIcon />
                </MenuTrigger>
                <MenuPopup>
                  <MenuItem onClick={() => void save("prompt")}>Save as Prompt</MenuItem>
                  <MenuItem onClick={() => void save("task")}>Save as Task</MenuItem>
                  <MenuItem onClick={() => void save("note")}>Save as Note</MenuItem>
                </MenuPopup>
              </Menu>
            </div>
          ) : null}
        </div>
        {error ? (
          <p role="alert" className="max-w-64 text-xs text-destructive">
            {error}
          </p>
        ) : null}
        {notice ? (
          <p role="status" className="text-xs text-muted-foreground">
            {notice}
          </p>
        ) : null}
        {hasContext && draft?.prompt.trim() ? (
          <p className="max-w-64 text-xs text-muted-foreground">
            Remove attachments and context to save text, or use Stash.
          </p>
        ) : null}
      </ComposerBanner.Root>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetPopup>
          <SheetHeader>
            <SheetTitle>Saved</SheetTitle>
            <SheetDescription>Prompts and notes, ready when you are.</SheetDescription>
          </SheetHeader>
          {open ? (
            <SavedItemsPanel {...props} canOperate={canOperate} close={() => setOpen(false)} />
          ) : null}
        </SheetPopup>
      </Sheet>
    </>
  );
}

function FilterMenu<T extends string>(props: {
  label: string;
  value: T;
  values: readonly T[];
  onChange: (value: T) => void;
}) {
  return (
    <Menu>
      <MenuTrigger render={<Button size="sm" variant="outline" aria-label={props.label} />}>
        {props.value}
        <ChevronDownIcon />
      </MenuTrigger>
      <MenuPopup>
        {props.values.map((value) => (
          <MenuItem key={value} onClick={() => props.onChange(value)}>
            {value}
          </MenuItem>
        ))}
      </MenuPopup>
    </Menu>
  );
}

function SavedItemsPanel(props: Props & { canOperate: boolean; close: () => void }) {
  const [scope, setScope] = useState<"This project" | "No project" | "All projects">(
    props.projectId ? "This project" : "No project",
  );
  const [kind, setKind] = useState<"All kinds" | "prompt" | "note">("All kinds");
  const [status, setStatus] = useState<"All statuses" | SavedItemStatus>("queued");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [markdown, setMarkdown] = useState("");
  const [runAt, setRunAt] = useState("");
  const ids = useRef(new Map<string, CommandId>());
  const navigate = useNavigate();
  const projectId = scope === "No project" ? null : props.projectId;
  const query = useEnvironmentQuery(
    serverEnvironment.savedItems({
      environmentId: props.environmentId,
      input: {
        ...(scope === "All projects" ? {} : { projectId }),
        ...(kind === "All kinds" ? {} : { kind }),
        ...(status === "All statuses" ? {} : { status }),
      },
    }),
  );
  const transition = useAtomCommand(serverEnvironment.transitionSavedItem);
  const importItem = useAtomCommand(serverEnvironment.importSavedItem);
  const launch = useAtomCommand(serverEnvironment.launchSavedItem);
  const schedule = useAtomCommand(serverEnvironment.scheduleSavedItem);
  const task = useAtomCommand(serverEnvironment.saveSavedItemAsTask);
  const items = query.data?.items ?? [];
  const selected = items.find((item) => item.id === selectedId);
  const parsed = parseSavedItemMarkdown(markdown);
  const commandId = (key: string) => {
    const old = ids.current.get(key);
    if (old) return old;
    const id = CommandId.make(randomUUID());
    ids.current.set(key, id);
    return id;
  };
  const act = async (key: string, action: (id: CommandId) => Promise<unknown>, message: string) => {
    if (busy || !props.canOperate) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await action(commandId(key));
      ids.current.delete(key);
      query.refresh();
      setNotice(message);
    } catch (cause) {
      setError(errorText(cause));
    } finally {
      setBusy(false);
    }
  };
  const changeStatus = (item: SavedItem, action: "archive" | "restore" | "requeue" | "done") =>
    void act(
      `${item.id}:${action}`,
      async (commandId) =>
        unwrap(
          await transition({
            environmentId: props.environmentId,
            input: { commandId, id: item.id, action },
          }),
        ),
      "Saved item updated",
    );
  const executionInput = (item: SavedItem, commandId: CommandId) => ({
    commandId,
    id: item.id,
    ...(item.projectId === null && props.projectId ? { projectId: props.projectId } : {}),
    modelSelection: props.modelSelection,
    runtimeMode: props.runtimeMode,
    interactionMode: props.interactionMode,
    workspaceStrategy: { type: "root" as const },
  });
  const importMarkdown = () =>
    void act(
      `import:${projectId}:${markdown}`,
      async (commandId) => {
        unwrap(
          await importItem({
            environmentId: props.environmentId,
            input: { commandId, markdown, projectId },
          }),
        );
        setImportOpen(false);
        setMarkdown("");
        setStatus("queued");
        setKind("All kinds");
      },
      "Imported saved item",
    );
  return (
    <div
      className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-6 pb-6"
      onPaste={(event) => {
        if ((event.target as HTMLElement).closest("input,textarea,[contenteditable=true]")) return;
        const text = event.clipboardData.getData("text/plain");
        if (parseSavedItemMarkdown(text).ok) {
          event.preventDefault();
          setMarkdown(text);
          setImportOpen(true);
        }
      }}
    >
      <div className="flex flex-wrap items-center gap-2">
        <FilterMenu
          label="Saved project filter"
          value={scope}
          values={
            props.projectId
              ? ["This project", "No project", "All projects"]
              : ["No project", "All projects"]
          }
          onChange={setScope}
        />
        <Button
          size="sm"
          variant="outline"
          disabled={!props.canOperate}
          onClick={() => setImportOpen(true)}
        >
          Import
        </Button>
        <Button size="sm" variant="ghost" onClick={query.refresh}>
          Refresh
        </Button>
      </div>
      <div className="flex flex-wrap gap-2">
        <FilterMenu
          label="Saved kind filter"
          value={kind}
          values={["All kinds", "prompt", "note"]}
          onChange={setKind}
        />
        <FilterMenu
          label="Saved status filter"
          value={status}
          values={["All statuses", "queued", "launched", "done", "archived"]}
          onChange={setStatus}
        />
      </div>
      {error || query.error ? (
        <p role="alert" className="text-sm text-destructive">
          {error ?? query.error}
        </p>
      ) : null}
      {notice ? (
        <p role="status" className="text-sm text-muted-foreground">
          {notice}
        </p>
      ) : null}
      {!props.canOperate ? (
        <p className="text-sm text-muted-foreground">This connection is read only.</p>
      ) : null}
      {query.isPending && query.data === null ? (
        <p role="status">Loading saved items…</p>
      ) : items.length === 0 && !query.error ? (
        <div className="space-y-2 py-8">
          <h3 className="font-medium">Nothing saved here yet</h3>
          <p className="text-sm text-muted-foreground">
            Save an unsent draft from the composer, or paste exported Markdown here to import it.
          </p>
        </div>
      ) : null}
      <ul className="space-y-2" aria-label="Saved items">
        {items.map((item) => (
          <li key={item.id}>
            <button
              type="button"
              className="w-full rounded-lg border border-border p-3 text-left hover:bg-muted/50 focus-visible:outline-2 focus-visible:outline-ring"
              aria-expanded={selectedId === item.id}
              onClick={() => {
                setSelectedId(selectedId === item.id ? null : item.id);
                setRunAt("");
              }}
            >
              <span className="block truncate text-sm font-medium">{item.title || "Untitled"}</span>
              <span className="block text-xs text-muted-foreground">
                {item.kind} · {item.status}
                {item.scheduledTaskId ? " · Scheduled" : ""}
                {item.pendingCommandId ? " · Working" : ""}
              </span>
              <span className="mt-1 block line-clamp-2 whitespace-pre-wrap text-sm text-muted-foreground">
                {item.body}
              </span>
            </button>
          </li>
        ))}
      </ul>
      {selected ? (
        <section className="space-y-3 border-t border-border pt-4" aria-label="Saved item details">
          <h3 className="break-words font-medium">{selected.title || "Untitled"}</h3>
          <p className="whitespace-pre-wrap break-words text-sm">{selected.body}</p>
          {selected.tags.length ? (
            <p className="text-xs text-muted-foreground">{selected.tags.join(" · ")}</p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                void navigator.clipboard.writeText(renderSavedItemMarkdown(selected)).then(
                  () => setNotice("Copied Markdown"),
                  (cause) => setError(errorText(cause)),
                );
              }}
            >
              Copy Markdown
            </Button>
            {selected.launchedThreadId ? (
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  props.close();
                  void navigate({
                    to: "/$environmentId/$threadId",
                    params: {
                      environmentId: props.environmentId,
                      threadId: selected.launchedThreadId!,
                    },
                  });
                }}
              >
                Open thread
              </Button>
            ) : null}
            {selected.scheduledTaskId ? (
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  props.close();
                  void navigate({
                    to: "/settings/scheduled-tasks",
                    search: { environmentId: props.environmentId },
                  });
                }}
              >
                Manage schedule
              </Button>
            ) : null}
          </div>
          <fieldset
            disabled={busy || !props.canOperate || !!selected.pendingCommandId}
            className="space-y-3"
          >
            <div className="flex flex-wrap gap-2">
              {selected.status === "archived" ? (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => changeStatus(selected, "restore")}
                >
                  Restore
                </Button>
              ) : (
                <>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => changeStatus(selected, "archive")}
                  >
                    Archive
                  </Button>
                  {selected.status !== "queued" ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => changeStatus(selected, "requeue")}
                    >
                      Requeue
                    </Button>
                  ) : null}
                  {selected.status !== "done" ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => changeStatus(selected, "done")}
                    >
                      Mark done
                    </Button>
                  ) : null}
                </>
              )}
              {selected.status === "queued" ? (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    void act(
                      `${selected.id}:task`,
                      async (commandId) =>
                        unwrap(
                          await task({
                            environmentId: props.environmentId,
                            input: { commandId, id: selected.id },
                          }),
                        ),
                      "Moved to Tasks",
                    )
                  }
                >
                  Move to Tasks
                </Button>
              ) : null}
            </div>
            {selected.kind === "prompt" && selected.status === "queued" ? (
              <>
                <p className="text-xs text-muted-foreground">
                  Runs in a new thread using the composer's current model and modes, in the project
                  root.
                  {selected.projectId === null && !props.projectId
                    ? " Select a project before running."
                    : ""}
                </p>
                <Button
                  size="sm"
                  disabled={
                    (selected.projectId === null && props.projectId === null) ||
                    !!selected.scheduledTaskId
                  }
                  onClick={() =>
                    void act(
                      `${selected.id}:launch`,
                      async (commandId) =>
                        unwrap(
                          await launch({
                            environmentId: props.environmentId,
                            input: executionInput(selected, commandId),
                          }),
                        ),
                      "Prompt launched. Switch to launched items to open its thread.",
                    )
                  }
                >
                  Launch prompt
                </Button>
                <label className="block space-y-1 text-sm">
                  <span>Run at (your local time)</span>
                  <Input
                    type="datetime-local"
                    value={runAt}
                    onChange={(event) => setRunAt(event.target.value)}
                  />
                </label>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={
                    !runAt ||
                    !Number.isFinite(new Date(runAt).getTime()) ||
                    !!selected.scheduledTaskId ||
                    (selected.projectId === null && props.projectId === null)
                  }
                  onClick={() =>
                    void act(
                      `${selected.id}:schedule:${runAt}`,
                      async (commandId) =>
                        unwrap(
                          await schedule({
                            environmentId: props.environmentId,
                            input: {
                              ...executionInput(selected, commandId),
                              runAt: new Date(runAt).toISOString(),
                            },
                          }),
                        ),
                      "Scheduled once",
                    )
                  }
                >
                  Schedule once
                </Button>
              </>
            ) : null}
          </fieldset>
          {selected.scheduledTaskId ? (
            <p className="text-xs text-muted-foreground">
              Archiving keeps its schedule active. Use Manage schedule to disable it.
            </p>
          ) : null}
        </section>
      ) : null}
      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogPopup>
          <DialogHeader>
            <DialogTitle>Import saved Markdown</DialogTitle>
            <DialogDescription>
              Paste an exported prompt or note. It will be queued in{" "}
              {projectId ? "this project" : "No project"}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 px-6">
            <Textarea
              aria-label="Saved Markdown"
              value={markdown}
              onChange={(event) => setMarkdown(event.target.value)}
            />
            {markdown && !parsed.ok ? (
              <p role="alert" className="text-sm text-destructive">
                {parsed.error}
              </p>
            ) : null}
            {parsed.ok ? (
              <p className="text-sm">
                {parsed.item.title || "Untitled"} · {parsed.item.kind}
              </p>
            ) : null}
            {error ? (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            ) : null}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setImportOpen(false)}>
              Cancel
            </Button>
            <Button disabled={!parsed.ok || busy || !props.canOperate} onClick={importMarkdown}>
              {busy ? "Importing…" : `Import as ${parsed.ok ? parsed.item.kind : "saved item"}`}
            </Button>
          </DialogFooter>
        </DialogPopup>
      </Dialog>
    </div>
  );
}
