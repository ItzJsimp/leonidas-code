import { scopeThreadRef } from "@t3tools/client-runtime/environment";
import type { EnvironmentId } from "@t3tools/contracts";
import { useNavigate } from "@tanstack/react-router";
import * as Schema from "effect/Schema";
import { CheckIcon, CopyIcon } from "lucide-react";
import { useRef, useState } from "react";

import { buildThreadRouteParams } from "../../threadRoutes";
import { useCopyToClipboard } from "../../hooks/useCopyToClipboard";
import { useLocalStorage } from "../../hooks/useLocalStorage";
import { describeInspection, needsConfirmation } from "../../onboarding/folderInspection.logic";
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
  onContinue,
  onLeave,
}: {
  readonly environmentId: EnvironmentId | undefined;
  readonly onContinue: () => void;
  /** Called before the setup chat opens, so the wizard can finish first. */
  readonly onLeave?: () => void | Promise<unknown>;
}) {
  const [chosenMode, setMode] = useState<AiosMode | null>(null);
  const navigate = useNavigate();
  const { canOperate, ensureFolderProject, startChat } = useOnboardingChat(environmentId);
  // Running it in Leonidas is the easy path, so it leads whenever an agent is connected.
  const mode = chosenMode ?? (canOperate ? "run" : "prompt");
  const [folder, setFolder] = useLocalStorage(
    AIOS_FOLDER_STORAGE_KEY,
    DEFAULT_AIOS_FOLDER,
    Schema.String,
  );
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  const [stored] = useLocalStorage(LEONIDAS_GOALS_STORAGE_KEY, [], LeonidasGoalsSchema);
  const prompt = buildAiosSetupPrompt(normalizeGoalIds(stored));
  const { copyToClipboard, isCopied } = useCopyToClipboard();

  const inspectFolder = useFolderInspection(environmentId);
  const [folderNotice, setFolderNotice] = useState<readonly string[] | null>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  const checkThenStart = async () => {
    if (!environmentId) return;
    setStarting(true);
    setStartError(null);
    const inspection = await inspectFolder(
      folder.trim() || DEFAULT_AIOS_FOLDER,
      AIOS_PRESET.filter((entry) => !entry.path.endsWith("/")).map((entry) => entry.path),
    );
    if (needsConfirmation(inspection)) {
      setFolderNotice(describeInspection(inspection));
      setStarting(false);
      return;
    }
    await startSetupChat();
  };

  const startSetupChat = async () => {
    if (!environmentId) return;
    setFolderNotice(null);
    setStarting(true);
    setStartError(null);
    const project = await ensureFolderProject(folder.trim() || DEFAULT_AIOS_FOLDER);
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
              <label className="block space-y-1.5">
                <span className="text-xs text-muted-foreground">
                  AIOS folder (created if missing)
                </span>
                <Input
                  ref={folderInputRef}
                  value={folder}
                  onChange={(event) => {
                    setFolder(event.target.value);
                    setFolderNotice(null);
                  }}
                />
              </label>
              <div className="flex items-center gap-3">
                <Button disabled={!canOperate || starting} onClick={() => void checkThenStart()}>
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
                  lines={folderNotice}
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
          <Button
            size="xs"
            variant="ghost-muted"
            onClick={() => setMode(mode === "run" ? "prompt" : "run")}
          >
            {mode === "run" ? "Rather use another AI? Copy the prompt" : "Back to running it here"}
          </Button>
        </div>
      </ScrollArea>
      <div className="mt-6 flex justify-end">
        <Button variant="ghost" onClick={onContinue}>
          Skip for now
        </Button>
      </div>
    </>
  );
}
