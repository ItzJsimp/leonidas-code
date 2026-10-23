import { useCallback, useEffect, useState } from "react";

import { Button } from "../../ui/button";
import { Dialog } from "../../ui/dialog";
import { toastManager } from "../../ui/toast";
import { WizardHeader, WizardPanel, WizardPopup, WizardSteps } from "../../ui/wizard";
import { T3Wordmark } from "../../T3Wordmark";
import { setOnboardingSimActive } from "./onboardingSim.flag";
import {
  addToHistory,
  describeClickTarget,
  finishRun,
  isCountedKey,
  moveToStep,
  PERSONA_LABELS,
  recordClick,
  recordKey,
  reportFileName,
  SIM_STEP_LABELS,
  SIM_STEPS,
  startRun,
  totalKeys,
  type SimHistoryEntry,
  type SimPersona,
  type SimRun,
  type SimStep,
} from "./onboardingSim.logic";
import { SimAgentsStep } from "./SimAgentsStep";
import { SimHud } from "./SimHud";
import {
  SimAiosStep,
  SimConnectStep,
  SimImportStep,
  SimSkillsStep,
  SimWelcomeStep,
} from "./SimSteps";

const RUN_STORAGE_KEY = "leonidas:onboarding-sim-run";
const HISTORY_STORAGE_KEY = "leonidas:onboarding-sim-history";
const SIM_STAGES = SIM_STEPS.map((step) => SIM_STEP_LABELS[step]);

function readStored<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function downloadReport(entry: SimHistoryEntry): void {
  const url = URL.createObjectURL(new Blob([entry.report], { type: "text/markdown" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = reportFileName(entry);
  link.click();
  URL.revokeObjectURL(url);
}

function copyText(text: string): void {
  void navigator.clipboard
    .writeText(text)
    .then(() => toastManager.add({ type: "success", title: "Simulation report copied" }));
}

/**
 * Stands in for the whole app on a dev profile: a replica of the first-run
 * wizard fed with fake agents and projects, so nothing here can touch a real
 * account, folder or project. Counts every click and keystroke a new user would
 * need, keeps a pinned list of improvements, and saves each finished run.
 */
export function OnboardingSimulation() {
  const [run, setRun] = useState<SimRun | null>(() =>
    readStored<SimRun | null>(RUN_STORAGE_KEY, null),
  );
  const [history, setHistory] = useState<readonly SimHistoryEntry[]>(() =>
    readStored<readonly SimHistoryEntry[]>(HISTORY_STORAGE_KEY, []),
  );
  const [goals, setGoals] = useState<readonly string[]>([]);
  const active = run !== null && run.finishedAt === null;

  const update = useCallback((change: (current: SimRun) => SimRun) => {
    setRun((current) => (current === null ? current : change(current)));
  }, []);

  useEffect(() => {
    if (run === null) localStorage.removeItem(RUN_STORAGE_KEY);
    else localStorage.setItem(RUN_STORAGE_KEY, JSON.stringify(run));
  }, [run]);

  // A finished run is saved to history and downloaded once, so no report depends on a copy button.
  useEffect(() => {
    if (run === null || run.finishedAt === null) return;
    const stored = readStored<readonly SimHistoryEntry[]>(HISTORY_STORAGE_KEY, []);
    const next = addToHistory(stored, run);
    if (next === stored) return;
    localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(next));
    setHistory(next);
    if (next[0]) downloadReport(next[0]);
  }, [run]);

  // Capture phase so a control that stops propagation is still counted. Pointer
  // press, not click: a label forwards one press to its checkbox as two clicks.
  useEffect(() => {
    if (!active) return;
    const onPointerDown = (event: PointerEvent) => {
      if (event.button !== 0 || !event.isTrusted) return;
      const label = describeClickTarget(event.target);
      if (label !== null) update((current) => recordClick(current, label, Date.now()));
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (!event.isTrusted || !isCountedKey(event)) return;
      if (event.target instanceof Element && event.target.closest("[data-sim-hud]")) return;
      update((current) => recordKey(current, Date.now()));
    };
    window.addEventListener("pointerdown", onPointerDown, true);
    window.addEventListener("keydown", onKeyDown, true);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown, true);
      window.removeEventListener("keydown", onKeyDown, true);
    };
  }, [active, update]);

  const go = (step: SimStep) => update((current) => moveToStep(current, step));
  const finish = (endedAt: string | null) =>
    update((current) =>
      current.finishedAt === null ? finishRun(current, Date.now(), endedAt) : current,
    );
  const addExternal = (label: string) =>
    update((current) => ({
      ...current,
      external: [...current.external, { step: current.step, label }],
    }));
  const restart = () => {
    setRun(null);
    setGoals([]);
  };
  const exit = () => {
    localStorage.removeItem(RUN_STORAGE_KEY);
    setOnboardingSimActive(false);
  };

  if (run === null) {
    return (
      <PersonaPicker
        history={history}
        onStart={(persona) => setRun(startRun(persona, Date.now()))}
        onExit={exit}
      />
    );
  }
  if (run.finishedAt !== null) {
    const entry = history.find((item) => item.finishedAt === run.finishedAt);
    return (
      <SimReport
        run={run}
        report={entry?.report ?? ""}
        onDownload={() => entry && downloadReport(entry)}
        onCopy={() => entry && copyText(entry.report)}
        onRestart={restart}
        onExit={exit}
      />
    );
  }

  const stageIndex = SIM_STEPS.indexOf(run.step);
  const next = SIM_STEPS[stageIndex + 1] ?? "import";
  // A single computer has nothing to choose, so Connect is skipped like in the real wizard.
  const back = () =>
    go(run.step === "agents" ? "welcome" : (SIM_STEPS[stageIndex - 1] ?? "welcome"));
  return (
    <>
      <Dialog
        open
        modal={false}
        disablePointerDismissal
        onOpenChange={(_, event) => event.cancel()}
      >
        <WizardPopup size="wide" bottomStickOnMobile={false} showCloseButton={false}>
          <WizardHeader
            title="Set up Leonidas"
            identity={
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2" role="img" aria-label="Leonidas">
                  <T3Wordmark className="size-6 shrink-0" aria-hidden />
                  <span className="text-xl font-medium tracking-tight text-foreground">
                    Leonidas
                  </span>
                </div>
                <Button
                  size="xs"
                  variant="ghost-muted"
                  onClick={() => finish("Skipped setup from the header")}
                >
                  Skip setup
                </Button>
              </div>
            }
          >
            <WizardSteps
              steps={SIM_STAGES}
              currentStep={stageIndex}
              isStepDisabled={(index) =>
                index >= stageIndex || (run.step === "aios" && SIM_STEPS[index] === "import")
              }
              onStepChange={(index) => {
                const target = SIM_STEPS[index] ?? "welcome";
                if (index < stageIndex && !(run.step === "aios" && target === "import")) go(target);
              }}
            />
          </WizardHeader>
          <WizardPanel stableHeight>
            {run.step === "welcome" ? (
              <SimWelcomeStep goals={goals} onGoals={setGoals} onContinue={() => go("agents")} />
            ) : run.step === "connect" ? (
              <SimConnectStep onContinue={() => go(next)} />
            ) : run.step === "agents" ? (
              <SimAgentsStep
                persona={run.persona}
                onExternal={addExternal}
                onBack={back}
                onContinue={() => go(next)}
              />
            ) : run.step === "skills" ? (
              <SimSkillsStep goals={goals} onBack={back} onContinue={() => go(next)} />
            ) : run.step === "import" ? (
              <SimImportStep persona={run.persona} onDone={() => go("aios")} />
            ) : (
              <SimAiosStep goals={goals} onContinue={() => finish(null)} onLeave={finish} />
            )}
          </WizardPanel>
        </WizardPopup>
      </Dialog>
      <SimHud
        run={run}
        onNote={(text) =>
          update((current) => ({
            ...current,
            notes: [
              ...current.notes,
              { step: current.step, text, at: Date.now(), clicksSoFar: current.clicks.length },
            ],
          }))
        }
        onRestart={restart}
        onExit={exit}
      />
    </>
  );
}

function ScreenCard({ children }: { readonly children: React.ReactNode }) {
  return (
    <main className="flex h-dvh items-center justify-center overflow-auto scrollbar-gutter-both bg-background px-6 text-foreground">
      <div className="w-full max-w-xl space-y-5 py-8">{children}</div>
    </main>
  );
}

function PersonaPicker({
  history,
  onStart,
  onExit,
}: {
  readonly history: readonly SimHistoryEntry[];
  readonly onStart: (persona: SimPersona) => void;
  readonly onExit: () => void;
}) {
  const [persona, setPersona] = useState<SimPersona>("fresh");
  return (
    <ScreenCard>
      <h1 className="text-2xl font-semibold tracking-tight">New-user simulation</h1>
      <p className="text-sm leading-relaxed text-muted-foreground">
        Walks the first-run setup exactly as someone who just installed Leonidas would see it. AI
        accounts, sign-ins and projects are all fake, so nothing touches a real account, folder or
        project. Counting starts on the first screen, and each finished run is saved.
      </p>
      <div className="space-y-2">
        {(Object.keys(PERSONA_LABELS) as SimPersona[]).map((id) => (
          <Button
            key={id}
            size="sm-multiline"
            variant={persona === id ? "secondary" : "outline"}
            className="min-h-12 w-full justify-start"
            onClick={() => setPersona(id)}
          >
            {PERSONA_LABELS[id]}
          </Button>
        ))}
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onExit}>
          Back to the real app
        </Button>
        <Button autoFocus onClick={() => onStart(persona)}>
          Start simulation
        </Button>
      </div>
      {history.length > 0 ? (
        <div className="space-y-1.5 border-t border-border pt-4">
          <h2 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            Past runs
          </h2>
          {history.slice(0, 5).map((entry) => (
            <div key={entry.finishedAt} className="flex items-center justify-between gap-3 text-sm">
              <span className="min-w-0 truncate">
                {new Date(entry.finishedAt).toLocaleString()} · {entry.clicks} clicks ·{" "}
                {entry.persona === "fresh" ? "brand-new" : "existing user"}
              </span>
              <span className="flex shrink-0 gap-1">
                <Button size="xs" variant="ghost" onClick={() => copyText(entry.report)}>
                  Copy
                </Button>
                <Button size="xs" variant="ghost" onClick={() => downloadReport(entry)}>
                  Download
                </Button>
              </span>
            </div>
          ))}
        </div>
      ) : null}
    </ScreenCard>
  );
}

function SimReport({
  run,
  report,
  onDownload,
  onCopy,
  onRestart,
  onExit,
}: {
  readonly run: SimRun;
  readonly report: string;
  readonly onDownload: () => void;
  readonly onCopy: () => void;
  readonly onRestart: () => void;
  readonly onExit: () => void;
}) {
  return (
    <ScreenCard>
      <h1 className="text-2xl font-semibold tracking-tight">Simulation finished</h1>
      <p className="text-sm text-muted-foreground">
        {run.clicks.length} clicks and {totalKeys(run)} keystrokes to get through setup. Saved to
        your Downloads folder and to Past runs.
      </p>
      <pre className="max-h-[50dvh] overflow-auto rounded-md border bg-muted/40 p-3 font-mono text-xs leading-relaxed whitespace-pre-wrap">
        {report}
      </pre>
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onExit}>
          Back to the real app
        </Button>
        <Button variant="outline" onClick={onRestart}>
          Run again
        </Button>
        <Button variant="outline" onClick={onCopy}>
          Copy report
        </Button>
        <Button autoFocus onClick={onDownload}>
          Download again
        </Button>
      </div>
    </ScreenCard>
  );
}
