import {
  isAtomCommandInterrupted,
  squashAtomCommandFailure,
} from "@t3tools/client-runtime/state/runtime";
import { AuthFilesystemWriteScope, type EnvironmentId } from "@t3tools/contracts";
import { useState } from "react";

import {
  INTERVIEW_QUESTIONS,
  buildAiosFiles,
  cleanAnswer,
  firstMissingRequired,
  planCreateOnly,
  type InterviewAnswers,
  type InterviewQuestionId,
} from "../../onboarding/aiosInterview.logic";
import { useFolderInspection } from "../../onboarding/useFolderInspection";
import { useOnboardingChat } from "../../onboarding/useOnboardingChat";
import { projectEnvironment } from "~/state/projects";
import { useEnvironmentScope } from "~/state/session";
import { useAtomCommand } from "~/state/use-atom-command";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Spinner } from "../ui/spinner";
import { Textarea } from "../ui/textarea";

type FormState =
  | { readonly status: "idle" }
  | { readonly status: "working" }
  | { readonly status: "error"; readonly message: string }
  | {
      readonly status: "done";
      readonly created: readonly string[];
      readonly skipped: readonly string[];
    };

/**
 * Eight typed questions, then plain files written with no AI call. A file that already
 * exists is skipped, never replaced, and an unreadable folder stops the write.
 */
export function AiosInterviewForm({
  environmentId,
  folder,
  onDone,
}: {
  readonly environmentId: EnvironmentId | undefined;
  readonly folder: string | null;
  readonly onDone: () => void;
}) {
  const [answers, setAnswers] = useState<InterviewAnswers>({});
  const [state, setState] = useState<FormState>({ status: "idle" });
  const { canOperate, ensureFolderProject } = useOnboardingChat(environmentId);
  const canWriteFiles = useEnvironmentScope(environmentId ?? null, AuthFilesystemWriteScope);
  const writeFile = useAtomCommand(projectEnvironment.writeFile, { reportFailure: false });
  const inspectFolder = useFolderInspection(environmentId);

  const missing = firstMissingRequired(answers);
  const working = state.status === "working";
  const canCreate = missing === null && canOperate && canWriteFiles && folder !== null && !working;

  const setAnswer = (id: InterviewQuestionId, value: string) =>
    setAnswers((current) => ({ ...current, [id]: value }));

  const create = async () => {
    if (!environmentId || folder === null || missing !== null) return;
    setState({ status: "working" });
    const planned = buildAiosFiles(answers);
    const inspection = await inspectFolder(
      folder,
      planned.map((file) => file.relativePath),
    );
    if (inspection._tag === "unknown" || inspection._tag === "notDirectory") {
      setState({
        status: "error",
        message:
          "Could not check that folder, so nothing was written. Check the path and try again.",
      });
      return;
    }
    if (inspection._tag === "unreadable") {
      setState({ status: "error", message: "Leonidas Code cannot read that folder." });
      return;
    }
    const existing = inspection._tag === "directory" ? inspection.existingFiles : [];
    const plan = planCreateOnly(planned, existing);
    const project = await ensureFolderProject(folder);
    if (!project.ok) {
      setState({ status: "error", message: project.message });
      return;
    }
    const created: string[] = [];
    for (const file of plan.toCreate) {
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
          } Run it again to finish: files already saved are skipped.`,
        });
        return;
      }
      created.push(file.relativePath);
    }
    setState({ status: "done", created, skipped: plan.skipped });
  };

  if (state.status === "done") {
    return (
      <div className="space-y-3" role="status">
        <p className="text-sm font-medium text-foreground">Your AI memory is ready in {folder}.</p>
        <ul className="space-y-1 font-mono text-xs">
          {state.created.map((path) => (
            <li key={path}>Created {path}</li>
          ))}
          {state.skipped.map((path) => (
            <li key={path} className="text-muted-foreground">
              Kept your existing {path}
            </li>
          ))}
        </ul>
        <Button onClick={onDone}>Continue</Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {INTERVIEW_QUESTIONS.map((question) => {
        const value = answers[question.id] ?? "";
        return (
          <label key={question.id} className="block space-y-1.5">
            <span className="text-sm text-foreground">
              {question.label}
              {question.required ? null : (
                <span className="ml-1.5 text-xs text-muted-foreground">Optional</span>
              )}
            </span>
            {question.multiline ? (
              <Textarea
                rows={2}
                value={value}
                maxLength={2000}
                onChange={(event) => setAnswer(question.id, event.target.value)}
              />
            ) : (
              <Input
                value={value}
                maxLength={2000}
                onChange={(event) => setAnswer(question.id, event.target.value)}
              />
            )}
            <span className="block text-xs text-muted-foreground">{question.hint}</span>
          </label>
        );
      })}
      <div className="flex items-center gap-3">
        <Button disabled={!canCreate} onClick={() => void create()}>
          {working ? <Spinner /> : null}
          Create my AI memory
        </Button>
        <p className="text-xs text-muted-foreground">
          {!canOperate || !canWriteFiles
            ? "This computer cannot save files here. Use the AI option below."
            : missing !== null
              ? `Answer “${cleanAnswer(missing.label)}” to continue.`
              : "Existing files are never replaced."}
        </p>
      </div>
      {state.status === "error" ? (
        <p role="alert" className="text-xs text-destructive-foreground">
          {state.message}
        </p>
      ) : null}
    </div>
  );
}
