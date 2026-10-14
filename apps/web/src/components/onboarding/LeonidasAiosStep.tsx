import { scopeThreadRef } from "@t3tools/client-runtime/environment";
import type { EnvironmentId } from "@t3tools/contracts";
import { useNavigate } from "@tanstack/react-router";
import * as Schema from "effect/Schema";
import { CheckIcon, CopyIcon } from "lucide-react";
import { useRef, useState } from "react";

import { buildThreadRouteParams } from "../../threadRoutes";
import { useCopyToClipboard } from "../../hooks/useCopyToClipboard";
import { useLocalStorage } from "../../hooks/useLocalStorage";
import {
  buildAiosFoldersCommand,
  describeAiosFolder,
  joinAiosFolder,
  splitAiosFolder,
  type AiosFolderNotice,
} from "../../onboarding/aiosFolders.logic";
import { useFolderInspection } from "../../onboarding/useFolderInspection";
import { useOnboardingChat } from "../../onboarding/useOnboardingChat";
import {
  AIOS_FOLDER_STORAGE_KEY,
  AIOS_PRESET,
  buildAiosSetupPrompt,
  DEFAULT_AIOS_FOLDER,
  LEONIDAS_GOALS_STORAGE_KEY,
  LeonidasGoalsSchema,
  normalizeGoalIds,
} from "../../onboarding/leonidasSetup.logic";
import { Button } from "../ui/button";
import { FolderCheckNotice } from "./FolderCheckNotice";
import { Input } from "../ui/input";
import { Spinner } from "../ui/spinner";
import { ScrollArea } from "../ui/scroll-area";

type AiosMode = "prompt" | "run";

export function LeonidasAiosStep({
  environmentId,
  onBack,
  onContinue,
  onLeave,
}: {
  readonly environmentId: EnvironmentId | undefined;
  readonly onBack: () => void;
  readonly onContinue: () => void;
  /** Called before the setup chat opens, so the wizard can finish first. */
  readonly onLeave?: () => void | Promise<unknown>;
}) {
  const [chosenMode, setMode] = useState<AiosMode | null>(null);
  const navigate = useNavigate();
  const { canOperate, ensureFolderProject, startChat } = useOnboardingChat(environmentId);
  // Running it in Leonidas is the easy path, so it leads whenever an agent is connected.
  const mode = chosenMode ?? (canOperate ? "run" : "prompt");
  const [storedFolder, setStoredFolder] = useLocalStorage(
    AIOS_FOLDER_STORAGE_KEY,
    DEFAULT_AIOS_FOLDER,
    Schema.String,
  );
  // Two inputs, one stored path: the other onboarding steps read the joined folder.
  const [parts, setParts] = useState(() => splitAiosFolder(storedFolder || DEFAULT_AIOS_FOLDER));
  const folder = joinAiosFolder(parts.location, parts.name);
  const updateParts = (next: { location: string; name: string }) => {
    setParts(next);
    setFolderNotice(null);
    const joined = joinAiosFolder(next.location, next.name);
    if (joined !== null) setStoredFolder(joined);
  };
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  const [stored] = useLocalStorage(LEONIDAS_GOALS_STORAGE_KEY, [], LeonidasGoalsSchema);
  const prompt = buildAiosSetupPrompt(normalizeGoalIds(stored));
  const { copyToClipboard, isCopied } = useCopyToClipboard();
  // Its own copy state, so copying the command does not mark the prompt as copied.
  const noChat = useCopyToClipboard();
  const folderCommand = buildAiosFoldersCommand(folder ?? DEFAULT_AIOS_FOLDER);

  const inspectFolder = useFolderInspection(environmentId);
  const [folderNotice, setFolderNotice] = useState<AiosFolderNotice | null>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  const checkThenStart = async () => {
    if (!environmentId || folder === null) return;
    setStarting(true);
    setStartError(null);
    const inspection = await inspectFolder(
      folder,
      AIOS_PRESET.filter((entry) => !entry.path.endsWith("/")).map((entry) => entry.path),
    );
    const notice = describeAiosFolder(inspection);
    if (notice !== null) {
      setFolderNotice(notice);
      setStarting(false);
      return;
    }
    await startSetupChat();
  };

  const startSetupChat = async () => {
    if (!environmentId || folder === null) return;
    setFolderNotice(null);
    setStarting(true);
    setStartError(null);
    const project = await ensureFolderProject(folder);
    if (!project.ok) {
      setStartError(project.message);
      setStarting(false);
      return;
    }
    const chat = await startChat({
      projectId: project.projectId,
      title: "Set up my AIOS",
      prompt: buildAiosSetupPrompt(normalizeGoalIds(stored), { inCurrentFolder: true }),
    });
    if (!chat.ok) {
      setStartError(chat.message);
      setStarting(false);
      return;
    }
    await onLeave?.();
    await navigate({
      to: "/$environmentId/$threadId",
      params: buildThreadRouteParams(scopeThreadRef(environmentId, chat.threadId)),
    });
  };

  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight text-foreground">
        Give your AI a memory
      </h1>
      <p className="mt-2.5 text-sm leading-relaxed text-muted-foreground">
        Optional. Your AI starts every session knowing who you are and what you work on, because it
        reads a few plain text files first (an “AIOS”). Leonidas can build them with you.
      </p>
      <ScrollArea scrollFade className="mt-5 h-auto max-h-[min(32rem,55dvh)]">
        <div className="space-y-4 pr-3">
          <ul className="space-y-1.5">
            {AIOS_PRESET.map((entry) => (
              <li key={entry.path} className="flex items-baseline gap-3">
                <span className="w-24 shrink-0 font-mono text-xs">{entry.path}</span>
                <span className="text-xs text-muted-foreground">{entry.purpose}</span>
              </li>
            ))}
          </ul>
          {mode === "prompt" ? (
            <div className="space-y-2">
              <pre className="max-h-56 overflow-auto rounded-md border bg-muted/40 p-3 font-mono text-xs leading-relaxed whitespace-pre-wrap">
                {prompt}
              </pre>
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs text-muted-foreground">
                  Paste it into the AI you already use.
                </p>
                <Button
                  size="compact"
                  variant="outline"
                  onClick={() => copyToClipboard(prompt, undefined)}
                >
                  {isCopied ? <CheckIcon /> : <CopyIcon />}
                  {isCopied ? "Copied" : "Copy"}
                </Button>
              </div>
            </div>
          ) : null}
          {mode === "run" ? (
            <div className="space-y-2">
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block space-y-1.5">
                  <span className="text-xs text-muted-foreground">Where to put it</span>
                  <Input
                    value={parts.location}
                    onChange={(event) => updateParts({ ...parts, location: event.target.value })}
                  />
                </label>
                <label className="block space-y-1.5">
                  <span className="text-xs text-muted-foreground">Folder name</span>
                  <Input
                    ref={folderInputRef}
                    value={parts.name}
                    onChange={(event) => updateParts({ ...parts, name: event.target.value })}
                  />
                </label>
              </div>
              <p className="text-xs text-muted-foreground">
                {folder === null
                  ? "Enter a location and a name."
                  : `Leonidas creates ${folder} if it is missing. ~ means your user folder.`}
              </p>
              <div className="flex items-center gap-3">
                <Button
                  disabled={!canOperate || starting || folder === null}
                  onClick={() => void checkThenStart()}
                >
                  {starting ? <Spinner /> : null}
                  Start setup chat
                </Button>
                <p className="text-xs text-muted-foreground">
                  {canOperate
                    ? "Your connected agent builds the folder with you."
                    : "Connect an agent first, then come back."}
                </p>
              </div>
              {folderNotice ? (
                <FolderCheckNotice
                  tone={folderNotice.tone}
                  lines={folderNotice.lines}
                  confirmLabel={folderNotice.tone === "info" ? "Continue" : undefined}
                  cancelLabel={folderNotice.tone === "info" ? "Pick another folder" : undefined}
                  onConfirm={() => void startSetupChat()}
                  onCancel={() => {
                    setFolderNotice(null);
                    folderInputRef.current?.focus();
                  }}
                />
              ) : null}
              {startError ? (
                <p className="text-xs text-destructive-foreground">{startError}</p>
              ) : null}
            </div>
          ) : null}
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">
              Prefer no chat? Paste this into PowerShell to create the same folders.
            </p>
            <div className="flex items-start justify-between gap-3">
              <pre className="min-w-0 flex-1 overflow-auto rounded-md border bg-muted/40 p-3 font-mono text-xs leading-relaxed whitespace-pre-wrap break-all">
                {folderCommand}
              </pre>
              <Button
                size="compact"
                variant="outline"
                onClick={() => noChat.copyToClipboard(folderCommand, undefined)}
              >
                {noChat.isCopied ? <CheckIcon /> : <CopyIcon />}
                {noChat.isCopied ? "Copied" : "Copy"}
              </Button>
            </div>
          </div>
          <Button
            size="xs"
            variant="ghost-muted"
            onClick={() => setMode(mode === "run" ? "prompt" : "run")}
          >
            {mode === "run" ? "Rather use another AI? Copy the prompt" : "Back to running it here"}
          </Button>
        </div>
      </ScrollArea>
      <div className="mt-6 flex items-center justify-between">
        <Button variant="ghost-muted" onClick={onBack}>
          Back
        </Button>
        <Button variant="ghost" onClick={onContinue}>
          Skip for now
        </Button>
      </div>
    </>
  );
}
