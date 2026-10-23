import {
  formatReplyStyleFile,
  LEONIDAS_REPLY_STYLE_SLUG,
  parseReplyStyleFile,
  REPLY_STYLE_MAX_BODY_LENGTH,
  type EnvironmentId,
  type ProjectId,
  type ScopedThreadRef,
} from "@t3tools/contracts";
import { resolveProjectSettings } from "@t3tools/shared/projectSettings";
import { CheckIcon, EyeIcon, MessageSquareTextIcon, PencilIcon, PlusIcon } from "lucide-react";
import { memo, useEffect, useState } from "react";

import { useEnvironmentSettings, useUpdateEnvironmentSettings } from "~/hooks/useSettings";
import { projectEnvironment } from "~/state/projects";
import { useEnvironmentQuery } from "~/state/query";
import { useAtomCommand } from "~/state/use-atom-command";
import { cn } from "~/lib/utils";
import { Button } from "../ui/button";
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
} from "../ui/dialog";
import { Input } from "../ui/input";
import {
  Menu,
  MenuCheckboxItem,
  MenuItem,
  MenuPopup,
  MenuRadioGroup,
  MenuRadioItem,
  MenuRadioItemIndicator,
  MenuSeparator,
  MenuTrigger,
} from "../ui/menu";
import { Textarea } from "../ui/textarea";
import { toastManager } from "../ui/toast";
import { Tooltip, TooltipPopup, TooltipTrigger } from "../ui/tooltip";
import { ComposerControl, ComposerControlIcon } from "./ComposerControl";
import { useComposerMenuProps } from "./composerEventScope";
import {
  REPLY_STYLE_PROBLEM_TEXT,
  replyStyleBodyForRepair,
  replyStyleDraftProblem,
  replyStyleRelativePath,
  replyStyleSlugFromName,
  resolveReplyStyleChip,
} from "./replyStylePicker.logic";
import { useThreadReplyStyle } from "./useThreadReplyStyle";

// One fallback toast per chat, style and cause in this window session, across reloads.
const ANNOUNCED_KEY = "leonidas:reply-style-announced:v1";
function announceOnce(key: string): boolean {
  try {
    const seen = new Set<string>(JSON.parse(sessionStorage.getItem(ANNOUNCED_KEY) ?? "[]"));
    if (seen.has(key)) return false;
    seen.add(key);
    sessionStorage.setItem(ANNOUNCED_KEY, JSON.stringify([...seen]));
  } catch {
    // Blocked or corrupt storage: still show the notice, it can repeat after a reload.
  }
  return true;
}

interface EditorTarget {
  /** Null for a new style, or for the read-only view of Leonidas. */
  readonly slug: string | null;
  /** True for the Leonidas view: the text shows but cannot change. */
  readonly readOnly?: boolean;
  readonly name: string;
  readonly description: string;
  readonly body: string;
}

/**
 * Composer chip: names the reply style this chat uses and switches it. Order matches the
 * server: chat choice, then project choice, then Leonidas. A broken style shows Leonidas
 * with an amber dot and one toast.
 */
export const ComposerReplyStyleControl = memo(function ComposerReplyStyleControl(props: {
  threadRef: ScopedThreadRef;
  serverValue: string | null | undefined;
  environmentId: EnvironmentId;
  projectId: ProjectId | null;
  cwd: string | null;
  size?: "sm" | "xs";
}) {
  const size = props.size ?? "sm";
  const { environmentId, projectId, cwd } = props;
  const menuProps = useComposerMenuProps();
  const settings = useEnvironmentSettings(environmentId);
  const updateSettings = useUpdateEnvironmentSettings(environmentId);
  const writeFile = useAtomCommand(projectEnvironment.writeFile, { reportFailure: false });
  const list = useEnvironmentQuery(
    cwd ? projectEnvironment.replyStyles({ environmentId, input: { cwd } }) : null,
  );
  const presets = list.data?.presets ?? null;
  const { chatSlug, choose } = useThreadReplyStyle({
    threadRef: props.threadRef,
    serverValue: props.serverValue,
  });
  const projectSlug = resolveProjectSettings(settings, projectId).settings.replyStyle;
  const chip = resolveReplyStyleChip({ presets, chatSlug, projectSlug });
  const [editor, setEditor] = useState<EditorTarget | null>(null);
  const threadKey = `${props.threadRef.environmentId}:${props.threadRef.threadId}`;

  const problemName = chip.problem?.name ?? null;
  const problemKey = chip.problem
    ? `${threadKey}:${chip.problem.slug}:${chip.problem.reason}`
    : null;
  const problemReason = chip.problem?.reason ?? null;
  useEffect(() => {
    if (problemKey === null || problemReason === null || !announceOnce(problemKey)) return;
    toastManager.add({
      type: "warning",
      title: `Reply style "${problemName}" could not load`,
      description: `Replies use Leonidas because ${REPLY_STYLE_PROBLEM_TEXT[problemReason]}.`,
    });
  }, [problemKey, problemName, problemReason]);

  const setProjectStyle = (slug: string) => {
    if (projectId === null) return;
    updateSettings({
      projectSettingsOverrides: {
        [projectId]: { ...settings.projectSettingsOverrides[projectId], replyStyle: slug },
      },
    });
  };

  const selected = presets?.find((preset) => preset.slug === chip.selectedSlug);
  const editableSelected = selected && !selected.builtin ? selected : null;
  const readFile = useEnvironmentQuery(
    editor?.slug && cwd
      ? projectEnvironment.readFile({
          environmentId,
          input: { cwd, relativePath: replyStyleRelativePath(editor.slug) },
        })
      : null,
  );

  const save = async (draft: EditorTarget) => {
    if (!cwd) return false;
    const slug =
      draft.slug ??
      replyStyleSlugFromName(
        draft.name,
        (presets ?? []).map((preset) => preset.slug),
      );
    const result = await writeFile({
      environmentId,
      input: {
        cwd,
        relativePath: replyStyleRelativePath(slug),
        contents: formatReplyStyleFile(draft),
      },
    });
    if (result._tag !== "Success") {
      toastManager.add({
        type: "error",
        title: "Reply style not saved",
        description:
          "Check that the project folder still exists and you can write to it, then save again.",
      });
      return false;
    }
    choose(slug);
    setProjectStyle(slug);
    list.refresh();
    if (draft.slug) readFile.refresh();
    return true;
  };

  const problemText = chip.problem
    ? `${chip.problem.name} could not load: ${REPLY_STYLE_PROBLEM_TEXT[chip.problem.reason]}. Replies use Leonidas.`
    : chip.source === "chat"
      ? `Reply style: ${chip.label}. Click to change it.`
      : `Reply style: ${chip.label} (project default). Click to change it.`;

  return (
    <>
      <Menu>
        <Tooltip>
          <TooltipTrigger
            render={
              <MenuTrigger
                render={
                  <ComposerControl
                    size={size}
                    aria-label={
                      chip.problem
                        ? `Reply style: Leonidas, because ${chip.problem.name} could not load`
                        : `Reply style: ${chip.label}`
                    }
                    data-reply-style-chip
                  />
                }
              />
            }
          >
            {chip.problem ? (
              <span
                aria-hidden="true"
                data-composer-control-icon
                className="size-2 shrink-0 rounded-full bg-warning-foreground"
              />
            ) : (
              <ComposerControlIcon
                icon={MessageSquareTextIcon}
                size={size}
                // A custom style tints the icon, so phones without the label still show it.
                className={
                  chip.activeSlug === LEONIDAS_REPLY_STYLE_SLUG ? undefined : "text-primary"
                }
              />
            )}
            {chip.problem ? null : (
              <span className="max-w-28 truncate text-foreground/80">{chip.label}</span>
            )}
          </TooltipTrigger>
          <TooltipPopup side="top" className="max-w-72">
            {problemText}
          </TooltipPopup>
        </Tooltip>
        <MenuPopup align="end" side="top" className="w-80 max-w-[calc(100vw-2rem)]" {...menuProps}>
          <div className="px-2 py-1.5 font-medium text-muted-foreground text-xs">Reply style</div>
          <MenuRadioGroup
            value={chip.selectedSlug}
            onValueChange={(value) => {
              if (typeof value === "string" && value !== chip.selectedSlug) choose(value);
            }}
          >
            {(presets ?? []).map((preset) => (
              <MenuRadioItem key={preset.slug} value={preset.slug} closeOnClick>
                <span className="flex min-w-0 items-center gap-2">
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="flex items-center gap-1.5 truncate font-medium">
                      {preset.problem ? (
                        <span
                          aria-hidden="true"
                          className="size-2 shrink-0 rounded-full bg-warning-foreground"
                        />
                      ) : null}
                      <span className="truncate">{preset.name || preset.slug}</span>
                      {preset.builtin ? (
                        <span className="rounded-full border border-border px-1.5 text-3xs text-muted-foreground">
                          Built in
                        </span>
                      ) : null}
                    </span>
                    <span className="truncate text-muted-foreground text-xs">
                      {preset.problem
                        ? `Cannot load: ${REPLY_STYLE_PROBLEM_TEXT[preset.problem]}`
                        : preset.description ||
                          (preset.builtin ? "The default Leonidas replies." : "")}
                    </span>
                  </span>
                  <MenuRadioItemIndicator>
                    <CheckIcon className="size-4" />
                  </MenuRadioItemIndicator>
                </span>
              </MenuRadioItem>
            ))}
          </MenuRadioGroup>
          {presets === null ? (
            <div className="px-2 py-2 text-muted-foreground text-sm">
              {cwd ? "Loading styles..." : "Open a project to choose a style."}
            </div>
          ) : null}
          <MenuSeparator />
          {projectId !== null && chip.problem === null ? (
            <MenuCheckboxItem
              className="min-h-10"
              checked={projectSlug === chip.selectedSlug}
              onCheckedChange={(checked) =>
                setProjectStyle(checked ? chip.selectedSlug : LEONIDAS_REPLY_STYLE_SLUG)
              }
            >
              <span className="truncate">Default for new chats in this project</span>
            </MenuCheckboxItem>
          ) : null}
          {editableSelected ? (
            <MenuItem
              className="min-h-10"
              onClick={() =>
                setEditor({
                  slug: editableSelected.slug,
                  name: editableSelected.name,
                  description: editableSelected.description,
                  body: "",
                })
              }
            >
              <PencilIcon />
              <span className="truncate">
                Edit {editableSelected.name || editableSelected.slug}
              </span>
            </MenuItem>
          ) : null}
          <MenuItem
            className="min-h-10"
            disabled={!list.data}
            onClick={() =>
              list.data &&
              setEditor({
                slug: null,
                readOnly: true,
                name: "Leonidas",
                description: "The shipped Leonidas reply style.",
                body: list.data.leonidasBody,
              })
            }
          >
            <EyeIcon />
            View Leonidas instructions
          </MenuItem>
          <MenuItem
            className="min-h-10"
            disabled={!cwd}
            onClick={() => setEditor({ slug: null, name: "", description: "", body: "" })}
          >
            <PlusIcon />
            New style...
          </MenuItem>
        </MenuPopup>
      </Menu>
      <ReplyStyleEditorDialog
        target={editor}
        loadedText={editor?.slug ? (readFile.data?.contents ?? null) : null}
        loadError={editor?.slug ? readFile.error : null}
        onClose={() => setEditor(null)}
        onSave={save}
        onCopy={(draft) => setEditor({ ...draft, slug: null, readOnly: false, name: "My style" })}
      />
    </>
  );
});

function ReplyStyleEditorDialog(props: {
  target: EditorTarget | null;
  /** The file text for an edit; null while it loads or for a new style. */
  loadedText: string | null;
  loadError: string | null;
  onClose: () => void;
  onSave: (draft: EditorTarget) => Promise<boolean>;
  onCopy: (draft: EditorTarget) => void;
}) {
  const { target, loadedText } = props;
  // A new style starts from the target. An edit starts from the file once it loads.
  let initial: EditorTarget | null = null;
  if (target?.slug === null) initial = target;
  else if (target && loadedText !== null) {
    const parsed = parseReplyStyleFile(loadedText);
    initial =
      "problem" in parsed
        ? { ...target, body: replyStyleBodyForRepair(loadedText) }
        : { slug: target.slug, ...parsed };
  }
  const isNew = target?.slug === null && !target.readOnly;

  return (
    <Dialog open={target !== null} onOpenChange={(open) => (open ? undefined : props.onClose())}>
      <DialogPopup className="max-w-xl">
        <DialogHeader>
          <DialogTitle>
            {target?.readOnly
              ? "Leonidas reply style"
              : isNew
                ? "New reply style"
                : `Edit ${target?.name ?? ""}`}
          </DialogTitle>
          <DialogDescription>
            {target?.readOnly
              ? "The built-in instructions. They cannot change, but you can copy them into your own style."
              : "Name it and write how replies should read. It is saved in your project under .agents/reply-styles and used for this chat."}
          </DialogDescription>
        </DialogHeader>
        {initial ? (
          <ReplyStyleEditorForm
            key={initial.readOnly ? "view" : (initial.slug ?? "new")}
            initial={initial}
            onClose={props.onClose}
            onSave={props.onSave}
            onCopy={props.onCopy}
          />
        ) : (
          <DialogPanel>
            <p className="text-muted-foreground text-sm">
              {props.loadError
                ? `Cannot open the style: ${props.loadError}`
                : "Loading the style..."}
            </p>
          </DialogPanel>
        )}
      </DialogPopup>
    </Dialog>
  );
}

function ReplyStyleEditorForm(props: {
  initial: EditorTarget;
  onClose: () => void;
  onSave: (draft: EditorTarget) => Promise<boolean>;
  onCopy: (draft: EditorTarget) => void;
}) {
  const [draft, setDraft] = useState(props.initial);
  const [saving, setSaving] = useState(false);
  const problem = replyStyleDraftProblem(draft);
  const length = draft.body.trim().length;
  const readOnly = props.initial.readOnly === true;

  return (
    <>
      <DialogPanel>
        <div className="grid gap-3 text-sm">
          <label className="grid gap-1">
            <span className="text-muted-foreground text-xs">Name</span>
            <Input
              autoFocus={!readOnly}
              readOnly={readOnly}
              placeholder="Short and plain"
              value={draft.name}
              onChange={(event) => setDraft({ ...draft, name: event.target.value })}
            />
          </label>
          <label className="grid gap-1">
            <span className="text-muted-foreground text-xs">Description (optional)</span>
            <Input
              readOnly={readOnly}
              placeholder="One line shown in the menu"
              value={draft.description}
              onChange={(event) => setDraft({ ...draft, description: event.target.value })}
            />
          </label>
          <label className="grid gap-1">
            <span className="text-muted-foreground text-xs">Instructions</span>
            <Textarea
              className="min-h-56"
              readOnly={readOnly}
              placeholder="Tell Leonidas how to reply, for example: Short answers. Plain words. No filler."
              value={draft.body}
              onChange={(event) => setDraft({ ...draft, body: event.target.value })}
            />
          </label>
        </div>
      </DialogPanel>
      <DialogFooter className="items-center">
        <span
          className={cn(
            "me-auto font-mono text-xs",
            length > REPLY_STYLE_MAX_BODY_LENGTH
              ? "text-destructive-foreground"
              : "text-muted-foreground",
          )}
          aria-live="polite"
        >
          {length.toLocaleString("en-US")} / {REPLY_STYLE_MAX_BODY_LENGTH.toLocaleString("en-US")}
        </span>
        <Button variant="outline" onClick={props.onClose}>
          {readOnly ? "Close" : "Cancel"}
        </Button>
        {readOnly ? (
          <Button onClick={() => props.onCopy(draft)}>Copy to my own style</Button>
        ) : (
          <Button
            disabled={problem !== null || saving}
            title={problem ?? undefined}
            onClick={async () => {
              setSaving(true);
              const saved = await props.onSave(draft);
              setSaving(false);
              if (saved) props.onClose();
            }}
          >
            Save and use
          </Button>
        )}
      </DialogFooter>
    </>
  );
}
