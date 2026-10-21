import { useState } from "react";

import {
  INTERVIEW_QUESTIONS,
  QUICK_QUESTION_IDS,
  answerFromChoices,
  choicesFromAnswer,
  defaultAnswers,
  type InterviewAnswers,
} from "../../../onboarding/aiosInterview.logic";
import { SETUP_COPY, visibleChoices, type SetupVoice } from "../../../onboarding/setupCopy";
import { cn } from "~/lib/utils";
import { Button } from "../../ui/button";
import { Spinner } from "../../ui/spinner";
import { MemoryImportPanel } from "./MemoryImportPanel";

const QUICK_QUESTIONS = INTERVIEW_QUESTIONS.filter((question) =>
  QUICK_QUESTION_IDS.includes(question.id),
);

/** Screen 3 of 3. Chips only, all optional; Skip still enters the app. */
export function SetupQuestionsScreen({
  voice,
  onBack,
  onSave,
  onSkip,
  onImport,
}: {
  readonly voice: SetupVoice;
  readonly onBack: () => void;
  /** Resolves to an error message, or null when the answers were saved. */
  readonly onSave: (answers: InterviewAnswers) => Promise<string | null>;
  readonly onSkip: () => void;
  readonly onImport: (pasted: string) => Promise<string | null>;
}) {
  const copy = SETUP_COPY[voice];
  const [answers, setAnswers] = useState<InterviewAnswers>(() => {
    const defaults = defaultAnswers();
    return Object.fromEntries(QUICK_QUESTION_IDS.map((id) => [id, defaults[id] ?? ""]));
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{copy.questionsTitle}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{copy.questionsLead}</p>
      </div>
      {QUICK_QUESTIONS.map((question) => {
        const chosen = choicesFromAnswer(question, answers[question.id] ?? "");
        return (
          <fieldset key={question.id} className="space-y-1.5">
            <legend className="text-sm font-medium">
              {question.label}
              <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                {question.hint}
              </span>
            </legend>
            <div className="flex flex-wrap gap-1.5">
              {visibleChoices(question.choices ?? [], voice).map((choice) => {
                const on = chosen.includes(choice);
                return (
                  <button
                    key={choice}
                    type="button"
                    aria-pressed={on}
                    className={cn(
                      "rounded-full px-3 py-1 text-xs ring-1 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
                      on
                        ? "bg-primary/10 text-primary ring-primary/40"
                        : "bg-card text-muted-foreground ring-black/10 hover:text-foreground dark:ring-white/10",
                    )}
                    onClick={() => {
                      const next =
                        question.kind === "single"
                          ? on
                            ? []
                            : [choice]
                          : on
                            ? chosen.filter((entry) => entry !== choice)
                            : [...chosen, choice];
                      setAnswers((current) => ({
                        ...current,
                        [question.id]: answerFromChoices(next),
                      }));
                    }}
                  >
                    {choice}
                  </button>
                );
              })}
            </div>
          </fieldset>
        );
      })}
      <MemoryImportPanel lead={copy.importLead} onSave={onImport} />
      {error ? (
        <div role="alert" className="space-y-2 text-xs text-destructive-foreground">
          <p>{error}</p>
          <Button variant="outline" size="sm" onClick={onSkip}>
            Continue without saving
          </Button>
        </div>
      ) : null}
      <div className="flex items-center justify-between gap-2">
        <Button variant="ghost" onClick={onBack}>
          Back
        </Button>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onSkip}>
            Skip for now
          </Button>
          <Button
            disabled={saving}
            onClick={async () => {
              setSaving(true);
              setError(await onSave(answers));
              setSaving(false);
            }}
          >
            {saving ? <Spinner /> : null}
            Save answers
          </Button>
        </div>
      </div>
    </div>
  );
}
