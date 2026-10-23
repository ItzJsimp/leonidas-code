import {
  isAtomCommandInterrupted,
  squashAtomCommandFailure,
} from "@t3tools/client-runtime/state/runtime";
import { AuthFilesystemWriteScope, type EnvironmentId } from "@t3tools/contracts";
import * as Schema from "effect/Schema";
import { ArrowRightIcon } from "lucide-react";
import { useRef, useState } from "react";

import { useLocalStorage } from "../../hooks/useLocalStorage";
import { SKILL_ROOTS, skillFiles, suggestSkills } from "../../onboarding/skillPacks";
import {
  SUBAGENT_ROOT,
  SUBAGENT_STARTERS,
  subagentStarterFiles,
} from "../../onboarding/subagentStarters";
import {
  AIOS_FOLDER_STORAGE_KEY,
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
import { Button } from "../ui/button";
import { Checkbox } from "../ui/checkbox";
import { FolderCheckNotice } from "./FolderCheckNotice";
import { Input } from "../ui/input";
import { ScrollArea } from "../ui/scroll-area";

type InstallState =
  | { readonly status: "idle" }
  | { readonly status: "installing" }
  | { readonly status: "error"; readonly message: string }
  | { readonly status: "installed"; readonly names: readonly string[]; readonly folder: string };

/**
 * One primary action: install the ticked skills, then show what landed where
 * before moving on. Installing and continuing used to be two buttons, so
 * clicking Continue alone silently installed nothing.
 */
export function LeonidasSkillsStep({
  environmentId,
  onBack,
  onContinue,
}: {
  readonly environmentId: EnvironmentId | undefined;
  readonly onBack: () => void;
  readonly onContinue: () => void;
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

  const { canOperate, ensureFolderProject } = useOnboardingChat(environmentId);
  const canWriteFiles = useEnvironmentScope(environmentId ?? null, AuthFilesystemWriteScope);
  const writeFile = useAtomCommand(projectEnvironment.writeFile, { reportFailure: false });

  const selected = skills.filter((skill) => !unchecked.has(skill.name));
  const installing = state.status === "installing";
  const trimmedFolder = folder.trim();
  const canInstall = selected.length > 0 && canOperate && canWriteFiles && trimmedFolder.length > 0;

  const toggle = (name: string, checked: boolean) =>
    setUnchecked((current) => {
      const next = new Set(current);
      if (checked) next.delete(name);
      else next.add(name);
      return next;
    });

  const inspectFolder = useFolderInspection(environmentId);
  const [pendingLines, setPendingLines] = useState<readonly string[] | null>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const [checking, setChecking] = useState(false);

  const checkThenInstall = async () => {
    setChecking(true);
    const files = [
      ...selected.flatMap((skill) =>
        SKILL_ROOTS.flatMap((root) => skillFiles(skill, root).map((file) => file.relativePath)),
      ),
      ...subagentStarterFiles().map((file) => file.relativePath),
    ];
    const inspection = await inspectFolder(trimmedFolder, files);
    setChecking(false);
    if (needsConfirmation(inspection)) {
      setPendingLines(describeInspection(inspection));
      return;
    }
    await install();
  };

  const install = async () => {
    if (!environmentId) return;
    setPendingLines(null);
    setState({ status: "installing" });
    const project = await ensureFolderProject(trimmedFolder);
    if (!project.ok) {
      setState({ status: "error", message: project.message });
      return;
    }
    const filesToWrite = [
      ...selected.flatMap((skill) => SKILL_ROOTS.flatMap((root) => skillFiles(skill, root))),
      ...subagentStarterFiles(),
    ];
    for (const file of filesToWrite) {
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
          message: `Could not save ${file.relativePath}. ${
            error instanceof Error ? error.message : "Try again."
          }`,
        });
        return;
      }
    }
    setState({
      status: "installed",
      names: selected.map((skill) => skill.name),
      folder: project.workspaceRoot,
    });
  };

  if (state.status === "installed") {
    return (
      <>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          {state.names.length} {state.names.length === 1 ? "skill" : "skills"} installed
        </h1>
        <p className="mt-2.5 text-sm leading-relaxed text-muted-foreground">
          Saved in <span className="font-mono text-xs">{state.folder}</span> under{" "}
          {SKILL_ROOTS.map((root, index) => (
            <span key={root}>
              {index > 0 ? " and " : null}
              <span className="font-mono text-xs">{root}</span>
            </span>
          ))}
          . Find them any time with the Skills button above the message box.
        </p>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          It also added {SUBAGENT_STARTERS.filter((starter) => starter.enabled).length} subagents
          that are on and {SUBAGENT_STARTERS.filter((starter) => !starter.enabled).length} you can
          turn on, in <span className="font-mono text-xs">{SUBAGENT_ROOT}</span>. Attach one with
          the Subagent button, or type @ and its name.
        </p>
        <ScrollArea scrollFade className="mt-5 h-auto max-h-[min(32rem,55dvh)]">
          <ul className="space-y-1 pr-3">
            {state.names.map((name) => (
              <li key={name} className="font-mono text-xs">
                {name}
              </li>
            ))}
          </ul>
        </ScrollArea>
        <div className="mt-6 flex justify-end">
          <Button autoFocus onClick={onContinue}>
            Continue
            <ArrowRightIcon className="size-3.5" />
          </Button>
        </div>
      </>
    );
  }

  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight text-foreground">
        Add skills for what you build
      </h1>
      <p className="mt-2.5 text-sm leading-relaxed text-muted-foreground">
        You get a starter set, plus skills that match the goals you picked. Leonidas saves them in
        your AIOS folder. Your AI loads them in every chat.
      </p>
      <ScrollArea scrollFade className="mt-5 h-auto max-h-[min(32rem,55dvh)]">
        <div className="space-y-4 pr-3">
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
                    <span className="block text-xs text-muted-foreground">{skill.description}</span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
          <label className="block space-y-1.5">
            <span className="text-xs font-medium">AIOS folder</span>
            <Input
              value={folder}
              ref={folderInputRef}
              onChange={(event) => {
                setFolder(event.target.value);
                setPendingLines(null);
              }}
              disabled={installing}
              spellCheck={false}
            />
            <span className="block text-xs text-muted-foreground">
              Leonidas creates the folder if it is missing.
            </span>
          </label>
          {pendingLines ? (
            <FolderCheckNotice
              lines={pendingLines}
              onConfirm={() => void install()}
              onCancel={() => {
                setPendingLines(null);
                folderInputRef.current?.focus();
              }}
            />
          ) : null}
          {!canOperate ? (
            <p className="text-xs text-muted-foreground">
              Connect to a computer to install skills.
            </p>
          ) : !canWriteFiles ? (
            <p className="text-xs text-muted-foreground">
              This connection cannot save files, so it cannot install skills. Connect to a different
              computer.
            </p>
          ) : null}
          {state.status === "error" ? (
            <p className="text-xs text-destructive-foreground">{state.message}</p>
          ) : null}
        </div>
      </ScrollArea>
      <div className="mt-6 flex items-center justify-between gap-2">
        <Button variant="ghost-muted" onClick={onBack} disabled={installing}>
          Back
        </Button>
        <div className="flex gap-2">
          {canInstall ? (
            <Button variant="ghost" onClick={onContinue} disabled={installing}>
              Skip
            </Button>
          ) : null}
          <Button
            autoFocus
            disabled={installing || checking}
            onClick={canInstall ? () => void checkThenInstall() : onContinue}
          >
            {installing
              ? "Installing…"
              : canInstall
                ? `Install ${selected.length} ${selected.length === 1 ? "skill" : "skills"} and continue`
                : "Continue"}
            <ArrowRightIcon className="size-3.5" />
          </Button>
        </div>
      </div>
    </>
  );
}
