import { useAtomValue } from "@effect/atom-react";
import type { EnvironmentId, ScopedProjectRef } from "@t3tools/contracts";
import { useNavigate } from "@tanstack/react-router";
import { useCallback, useState } from "react";

import { useLocalStorage } from "../../../hooks/useLocalStorage";
import {
  QUICK_QUESTION_IDS,
  buildAiosFiles,
  type InterviewAnswers,
  type PlannedFile,
} from "../../../onboarding/aiosInterview.logic";
import { useCompleteOnboarding } from "../../../onboarding/firstRun";
import {
  AIOS_FOLDER_STORAGE_KEY,
  DEFAULT_AIOS_FOLDER,
} from "../../../onboarding/leonidasSetup.logic";
import {
  SETUP_COPY,
  buildFirstTaskFile,
  buildImportedMemoryFile,
  fileStamp,
  firstTaskFrom,
  memoryPreviewFrom,
  voiceFor,
} from "../../../onboarding/setupCopy";
import {
  EMPTY_SETUP_STATE,
  SETUP_STATE_STORAGE_KEY,
  SetupStateSchema,
  markDone,
} from "../../../onboarding/setupState.logic";
import { useAiosFileWriter } from "../../../onboarding/useAiosFileWriter";
import { resolvedFolderPath } from "../../../onboarding/folderInspection.logic";
import { useFolderInspection } from "../../../onboarding/useFolderInspection";
import { ensureLocalApi } from "../../../localApi";
import { usePrimaryEnvironment } from "../../../state/environments";
import { primaryServerAvailableEditorsAtom } from "../../../state/server";
import * as Schema from "effect/Schema";
import { Dialog } from "../../ui/dialog";
import { Spinner } from "../../ui/spinner";
import { WizardHeader, WizardPanel, WizardPopup, WizardSteps } from "../../ui/wizard";
import { AgentsStep } from "../AgentsStep";
import { WelcomeWizard } from "../WelcomeWizard";
import { SetupBasicsScreen, type SetupBasics } from "./SetupBasicsScreen";
import { SetupPreviewBar } from "./SetupPreviewBar";
import { SetupQuestionsScreen } from "./SetupQuestionsScreen";

const STEPS = ["You", "AI account", "About you"] as const;

// The system folder picker exists only in the desktop app; a browser types the path instead.
const pickFolder = window.desktopBridge ? () => ensureLocalApi().dialogs.pickFolder() : undefined;
type Step = 0 | 1 | 2;

/**
 * First run in 3 screens. Anything skipped stays open on the Finish-setup checklist.
 * Remote, hosted and resumed setups keep the old wizard, which handles pairing.
 */
export function SetupFlow(props: {
  readonly localAvailable: boolean;
  readonly resumeEnvironmentId?: EnvironmentId | undefined;
  readonly onDone: (projectRef?: ScopedProjectRef) => void | Promise<void>;
}) {
  const primary = usePrimaryEnvironment();
  if (!props.localAvailable || props.resumeEnvironmentId !== undefined) {
    return <WelcomeWizard {...props} />;
  }
  // This computer is still loading. Mounting the old wizard here would flash it and run its effects.
  if (!primary) {
    return (
      <div role="status" className="fixed inset-0 grid place-items-center">
        <Spinner />
        <span className="sr-only">Loading setup</span>
      </div>
    );
  }
  return <LocalSetupFlow environmentId={primary.environmentId} />;
}

function LocalSetupFlow({ environmentId }: { readonly environmentId: EnvironmentId }) {
  const navigate = useNavigate();
  const editorIds = useAtomValue(primaryServerAvailableEditorsAtom);
  const completeOnboarding = useCompleteOnboarding();
  const { write } = useAiosFileWriter(environmentId);
  const [, setStoredFolder] = useLocalStorage(
    AIOS_FOLDER_STORAGE_KEY,
    DEFAULT_AIOS_FOLDER,
    Schema.String,
  );
  const [state, setState] = useLocalStorage(
    SETUP_STATE_STORAGE_KEY,
    EMPTY_SETUP_STATE,
    SetupStateSchema,
  );
  const [step, setStep] = useState<Step>(0);
  const [basics, setBasics] = useState<SetupBasics | null>(null);
  // True once the user saw the "folder has other files" note or a write succeeded.
  const [folderConfirmed, setFolderConfirmed] = useState(false);
  const voice = voiceFor(basics?.coder ?? state.coder);
  const inspectFolder = useFolderInspection(environmentId);
  const resolveFolder = useCallback(
    async (folder: string) => resolvedFolderPath(await inspectFolder(folder, []), folder),
    [inspectFolder],
  );

  const writeAios = async (folder: string, files: readonly PlannedFile[]) => {
    const result = await write(folder, files, { allowExisting: folderConfirmed });
    if (result.ok || result.needsConfirmation) setFolderConfirmed(true);
    return result;
  };

  const finish = async () => {
    // A failed save only means setup may show again next launch; it must not block entry now.
    await completeOnboarding().catch(() => undefined);
    // The Command Center hosts the tour and the Finish-setup checklist.
    await navigate({ to: "/command-center", replace: true });
  };

  const saveAnswers = async (answers: InterviewAnswers) => {
    if (!basics) return "Go back and name your AI first.";
    const firstTask = firstTaskFrom(answers);
    const result = await writeAios(basics.folder, [
      ...buildAiosFiles({ ...answers, name: basics.userName }, basics.aiName),
      ...(firstTask ? [buildFirstTaskFile(firstTask)] : []),
    ]);
    if (!result.ok) return result.message;
    const answered = QUICK_QUESTION_IDS.filter((id) => (answers[id] ?? "").trim() !== "").length;
    setState((current) => ({
      ...current,
      questionsAnswered: answered,
      memoryPreview: memoryPreviewFrom(answers),
      firstTask,
    }));
    void finish();
    return null;
  };

  const skipQuestions = async () => {
    // Still write the identity file, so the AI knows its name. A failure here never blocks entry.
    if (basics) {
      await writeAios(
        basics.folder,
        buildAiosFiles({ name: basics.userName }, basics.aiName),
      ).catch(() => undefined);
    }
    await finish();
  };

  const importMemory = async (pasted: string) => {
    if (!basics) return "Go back and name your AI first.";
    const result = await writeAios(basics.folder, [
      buildImportedMemoryFile(pasted, fileStamp(new Date())),
    ]);
    if (!result.ok) return result.message;
    if (result.created.length === 0) return "That memory was already saved. Try again.";
    setState((current) => markDone(current, "import"));
    return null;
  };

  return (
    <Dialog open disablePointerDismissal onOpenChange={(_, event) => event.cancel()}>
      <WizardPopup size="wide" bottomStickOnMobile={false} showCloseButton={false}>
        <WizardHeader title={voice === "builder" ? "Set up Leonidas" : "Set up Leonidas"}>
          <WizardSteps steps={STEPS} currentStep={step} />
        </WizardHeader>
        <WizardPanel stableHeight>
          <SetupPreviewBar />
          {step === 0 ? (
            <SetupBasicsScreen
              editorIds={editorIds}
              initial={basics ?? undefined}
              pickFolder={pickFolder}
              resolveFolder={resolveFolder}
              onContinue={(next) => {
                setBasics(next);
                if (next.folder !== basics?.folder) setFolderConfirmed(false);
                setStoredFolder(next.folder);
                setState((current) =>
                  markDone(
                    {
                      ...current,
                      coder: next.coder,
                      startedAt: current.startedAt ?? new Date().toISOString(),
                    },
                    "basics",
                  ),
                );
                setStep(1);
              }}
            />
          ) : step === 1 ? (
            <AgentsStep
              environmentIds={[environmentId]}
              title={SETUP_COPY[voice].accountTitle}
              description={SETUP_COPY[voice].accountLead}
              onBack={() => setStep(0)}
              onContinue={(ready) => {
                if (ready) setState((current) => markDone(current, "account"));
                setStep(2);
              }}
            />
          ) : (
            <SetupQuestionsScreen
              voice={voice}
              onBack={() => setStep(1)}
              onSave={saveAnswers}
              onSkip={() => void skipQuestions()}
              onImport={importMemory}
            />
          )}
        </WizardPanel>
      </WizardPopup>
    </Dialog>
  );
}
