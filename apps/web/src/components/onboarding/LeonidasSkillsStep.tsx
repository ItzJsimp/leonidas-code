import { scopeThreadRef } from "@t3tools/client-runtime/environment";
import {
  isAtomCommandInterrupted,
  squashAtomCommandFailure,
} from "@t3tools/client-runtime/state/runtime";
import { AuthFilesystemWriteScope, type EnvironmentId } from "@t3tools/contracts";
import { useNavigate } from "@tanstack/react-router";
import * as Schema from "effect/Schema";
import { ArrowRightIcon } from "lucide-react";
import { useRef, useState } from "react";

import { useLocalStorage } from "../../hooks/useLocalStorage";
import { skillFiles, suggestSkills } from "../../onboarding/skillPacks";
import {
  AIOS_FOLDER_STORAGE_KEY,
  buildSkillSuggestionPrompt,
  DEFAULT_AIOS_FOLDER,
  LEONIDAS_GOALS_STORAGE_KEY,
  LeonidasGoalsSchema,
  normalizeGoalIds,
} from "../../onboarding/leonidasSetup.logic";
import { describeInspection, needsConfirmation } from "../../onboarding/folderInspection.logic";
import { useFolderInspection } from "../../onboarding/useFolderInspection";
import { useOnboardingChat } from "../../onboarding/useOnboardingChat";
import { projectEnvironment } from "~/state/projects";
import { useEnvironmentScope } from "~/state/session";
import { useAtomCommand } from "~/state/use-atom-command";
import { buildThreadRouteParams } from "../../threadRoutes";
import { Button } from "../ui/button";
import { Checkbox } from "../ui/checkbox";
import { FolderCheckNotice } from "./FolderCheckNotice";
import { Input } from "../ui/input";
import { ScrollArea } from "../ui/scroll-area";

const SKILL_ROOTS = [".claude/skills", ".agents/skills"] as const;

type InstallState =
  | { readonly status: "idle" }
  | { readonly status: "installing" }
  | { readonly status: "done"; readonly count: number; readonly workspaceRoot: string }
  | { readonly status: "error"; readonly message: string };

export function LeonidasSkillsStep({
  environmentId,
  onContinue,
  onLeave,
}: {
  readonly environmentId: EnvironmentId | undefined;
  readonly onContinue: () => void;
  readonly onLeave?: () => unknown;
}) {
  const [stored] = useLocalStorage(LEONIDAS_GOALS_STORAGE_KEY, [], LeonidasGoalsSchema);
  const [folder, setFolder] = useLocalStorage(
    AIOS_FOLDER_STORAGE_KEY,
    DEFAULT_AIOS_FOLDER,
    Schema.String,
  );
  const goalIds = normalizeGoalIds(stored);
  const skills = suggestSkills(goalIds);
  const [unchecked, setUnchecked] = useState<ReadonlySet<string>>(new Set());
  const [state, setState] = useState<InstallState>({ status: "idle" });
  const [askError, setAskError] = useState<string | null>(null);
  const [asking, setAsking] = useState(false);

  const { canOperate, ensureFolderProject, startChat } = useOnboardingChat(environmentId);
  const canWriteFiles = useEnvironmentScope(environmentId ?? null, AuthFilesystemWriteScope);
  const writeFile = useAtomCommand(projectEnvironment.writeFile, { reportFailure: false });
  const navigate = useNavigate();

  const selected = skills.filter((skill) => !unchecked.has(skill.name));
  const installing = state.status === "installing";
  const trimmedFolder = folder.trim();
  const ready = canOperate && canWriteFiles && trimmedFolder.length > 0;

  const toggle = (name: string, checked: boolean) =>
    setUnchecked((current) => {
      const next = new Set(current);
      if (checked) next.delete(name);
      else next.add(name);
      return next;
    });

  const inspectFolder = useFolderInspection(environmentId);
  const [pending, setPending] = useState<{
    readonly action: "install" | "ideas";
    readonly lines: readonly string[];
  } | null>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const [checking, setChecking] = useState(false);

  const checkThen = async (action: "install" | "ideas") => {
    setChecking(true);
    const files =
      action === "install"
        ? selected.flatMap((skill) =>
            SKILL_ROOTS.flatMap((root) => skillFiles(skill, root).map((file) => file.relativePath)),
          )
        : [];
    const inspection = await inspectFolder(trimmedFolder, files);
    setChecking(false);
    if (needsConfirmation(inspection)) {
      setPending({ action, lines: describeInspection(inspection) });
      return;
    }
    await (action === "install" ? install() : askForIdeas());
  };

  const confirmPending = () => {
    if (!pending) return;
    const { action } = pending;
    setPending(null);
    void (action === "install" ? install() : askForIdeas());
  };

  const install = async () => {
    if (!environmentId) return;
    setState({ status: "installing" });
    const project = await ensureFolderProject(trimmedFolder);
    if (!project.ok) {
      setState({ status: "error", message: project.message });
      return;
    }
    for (const skill of selected) {
      for (const root of SKILL_ROOTS) {
        for (const file of skillFiles(skill, root)) {
          const result = await writeFile({
            environmentId,
            input: {
              cwd: project.workspaceRoot,
              relativePath: file.relativePath,
              contents: file.contents,
            },
          });
          if (result._tag !== "Success") {
            if (isAtomCommandInterrupted(result)) {
              setState({ status: "idle" });
              return;
            }
            const error = squashAtomCommandFailure(result);
            setState({
              status: "error",
              message: `Could not write ${file.relativePath}. ${
                error instanceof Error ? error.message : "Try again."
              }`,
            });
            return;
          }
        }
      }
    }
    setState({ status: "done", count: selected.length, workspaceRoot: project.workspaceRoot });
  };

  const askForIdeas = async () => {
    if (!environmentId) return;
    setAsking(true);
    setAskError(null);
    const project = await ensureFolderProject(trimmedFolder);
    if (!project.ok) {
      setAsking(false);
      setAskError(project.message);
      return;
    }
    const chat = await startChat({
      projectId: project.projectId,
      title: "Skill ideas",
      prompt: buildSkillSuggestionPrompt(
        goalIds,
        selected.map((skill) => skill.name),
      ),
    });
    if (!chat.ok) {
      setAsking(false);
      setAskError(chat.message);
      return;
    }
    await onLeave?.();
    setAsking(false);
    await navigate({
      to: "/$environmentId/$threadId",
      params: buildThreadRouteParams(scopeThreadRef(environmentId, chat.threadId)),
    });
  };

  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight text-foreground">
        Add skills for what you build
      </h1>
      <p className="mt-2.5 text-sm leading-relaxed text-muted-foreground">
        These skills match the goals you picked. They install into your AIOS folder so your AI loads
        them in every session.
      </p>
      <ScrollArea scrollFade className="mt-5 h-auto max-h-[min(32rem,55dvh)]">
        <div className="space-y-4 pr-3">
          {skills.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Pick goals on the first step to see matching skills.
            </p>
          ) : (
            <ul className="space-y-2.5">
              {skills.map((skill) => (
                <li key={skill.name}>
                  <label className="flex items-start gap-3">
                    <Checkbox
                      checked={!unchecked.has(skill.name)}
                      onCheckedChange={(checked) => toggle(skill.name, checked)}
                      disabled={installing}
                    />
                    <span className="min-w-0 space-y-0.5">
                      <span className="block font-mono text-xs">{skill.name}</span>
                      <span className="block text-xs text-muted-foreground">
                        {skill.description}
                      </span>
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          )}
          <label className="block space-y-1.5">
            <span className="text-xs font-medium">AIOS folder</span>
            <Input
              value={folder}
              ref={folderInputRef}
              onChange={(event) => {
                setFolder(event.target.value);
                setPending(null);
              }}
              disabled={installing}
              spellCheck={false}
            />
            <span className="block text-xs text-muted-foreground">
              Created if it does not exist.
            </span>
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              disabled={selected.length === 0 || !ready || installing || checking}
              onClick={() => void checkThen("install")}
            >
              Install {selected.length} {selected.length === 1 ? "skill" : "skills"}
            </Button>
            <Button
              variant="secondary"
              disabled={!ready || installing || asking || checking}
              onClick={() => void checkThen("ideas")}
            >
              Ask my AI for more ideas
            </Button>
          </div>
          {pending ? (
            <FolderCheckNotice
              lines={pending.lines}
              onConfirm={confirmPending}
              onCancel={() => {
                setPending(null);
                folderInputRef.current?.focus();
              }}
            />
          ) : null}
          {!canOperate ? (
            <p className="text-xs text-muted-foreground">
              Connect to an environment to install skills.
            </p>
          ) : !canWriteFiles ? (
            <p className="text-xs text-muted-foreground">
              This connection cannot write files, so skills cannot be installed.
            </p>
          ) : null}
          {state.status === "done" ? (
            <p className="text-xs text-muted-foreground">
              Installed {state.count} {state.count === 1 ? "skill" : "skills"} in{" "}
              {state.workspaceRoot}. Claude and Codex pick them up when you open that folder.
            </p>
          ) : null}
          {state.status === "error" ? (
            <p className="text-xs text-destructive-foreground">{state.message}</p>
          ) : null}
          {askError ? <p className="text-xs text-destructive-foreground">{askError}</p> : null}
        </div>
      </ScrollArea>
      <div className="mt-6 flex justify-end gap-2">
        <Button variant="ghost" onClick={onContinue}>
          Skip
        </Button>
        <Button autoFocus onClick={onContinue}>
          Continue
          <ArrowRightIcon className="size-3.5" />
        </Button>
      </div>
    </>
  );
}
