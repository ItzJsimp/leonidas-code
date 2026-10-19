import { squashAtomCommandFailure } from "@t3tools/client-runtime/state/runtime";
import type {
  EnvironmentId,
  LocalModelRow,
  LocalModelsCompareResult,
  LocalModelsPickResult,
} from "@t3tools/contracts";
import { useState } from "react";

import { localModelsCompare, localModelsComparePick } from "~/state/localModels";
import { useAtomCommand } from "~/state/use-atom-command";
import { Button } from "../ui/button";
import { Spinner } from "../ui/spinner";
import { Textarea } from "../ui/textarea";

const errorText = (error: unknown) => (error instanceof Error ? error.message : String(error));

function ModelSelect({
  label,
  value,
  models,
  onChange,
}: {
  label: string;
  value: string;
  models: ReadonlyArray<LocalModelRow>;
  onChange: (value: string) => void;
}) {
  return (
    <label className="grid min-w-0 flex-1 gap-1 text-2xs text-muted-foreground">
      {label}
      <select
        className="h-8 min-w-0 rounded-md border border-border bg-background px-2 text-sm text-foreground"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {models.map((model) => (
          <option key={model.id} value={model.id}>
            {model.name}
          </option>
        ))}
      </select>
    </label>
  );
}

/**
 * Blind compare of two installed models. Both answer one prompt, the person picks the better
 * answer as A or B, and only then sees which model wrote which. Picks are saved on the server.
 */
export function ModelCompareCard({
  environmentId,
  installed,
}: {
  environmentId: EnvironmentId;
  installed: ReadonlyArray<LocalModelRow>;
}) {
  const runCompare = useAtomCommand(localModelsCompare, { reportFailure: false });
  const runPick = useAtomCommand(localModelsComparePick, { reportFailure: false });
  const [prompt, setPrompt] = useState("");
  const [modelA, setModelA] = useState("");
  const [modelB, setModelB] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<LocalModelsCompareResult | null>(null);
  const [revealed, setRevealed] = useState<LocalModelsPickResult | null>(null);

  if (installed.length < 2) {
    return (
      <div className="rounded-lg border border-border px-3 py-2 text-sm text-muted-foreground">
        <span className="font-medium text-foreground">Compare models.</span> Install two models to
        compare their answers side by side.
      </div>
    );
  }
  const first = modelA || installed[0]!.id;
  const second = modelB || installed.find((model) => model.id !== first)!.id;
  const nameOf = (id: string) => installed.find((model) => model.id === id)?.name ?? id;

  const start = async () => {
    setBusy(true);
    setError(null);
    setResult(null);
    setRevealed(null);
    const outcome = await runCompare({
      environmentId,
      input: { prompt: prompt.trim(), modelA: first, modelB: second },
    });
    setBusy(false);
    if (outcome._tag === "Failure") {
      setError(errorText(squashAtomCommandFailure(outcome)));
      return;
    }
    setResult(outcome.value);
  };

  const pick = async (choice: "A" | "B" | "tie") => {
    if (result === null) return;
    setBusy(true);
    const outcome = await runPick({
      environmentId,
      input: { compareId: result.compareId, pick: choice },
    });
    setBusy(false);
    if (outcome._tag === "Failure") {
      setError(errorText(squashAtomCommandFailure(outcome)));
      return;
    }
    setRevealed(outcome.value);
  };

  return (
    <div className="grid gap-2 rounded-lg border border-border px-3 py-2">
      <div className="text-sm font-medium">Compare models</div>
      <p className="text-sm text-muted-foreground">
        Both models answer one prompt. You see the answers as A and B and pick the better one. Then
        the names show.
      </p>
      <div className="flex flex-wrap gap-2">
        <ModelSelect label="Model 1" value={first} models={installed} onChange={setModelA} />
        <ModelSelect label="Model 2" value={second} models={installed} onChange={setModelB} />
      </div>
      <Textarea
        aria-label="Prompt for both models"
        placeholder="Write the prompt both models answer"
        value={prompt}
        maxLength={4000}
        onChange={(event) => setPrompt(event.target.value)}
      />
      <div className="flex items-center gap-2">
        <Button
          size="xs"
          disabled={busy || prompt.trim().length === 0 || first === second}
          onClick={() => void start()}
        >
          {busy && result === null ? <Spinner size="sm" /> : null}
          {busy && result === null ? "Asking both models" : "Compare"}
        </Button>
        {first === second ? (
          <span className="text-2xs text-muted-foreground">Choose two different models.</span>
        ) : null}
      </div>
      {error !== null ? <p className="text-sm text-destructive-foreground">{error}</p> : null}
      {result !== null ? (
        <>
          <div className="grid gap-2 md:grid-cols-2">
            {result.answers.map((answer) => (
              <div key={answer.label} className="min-w-0 rounded-md border border-border/60 p-2">
                <div className="mb-1 text-xs font-medium">
                  Answer {answer.label}
                  {revealed !== null ? ` · ${nameOf(revealed.models[answer.label])}` : ""}
                  {revealed !== null ? (
                    <span className="font-normal text-muted-foreground">
                      {" "}
                      ·{" "}
                      {answer.tokensPerSecond === null
                        ? "n/a"
                        : `${answer.tokensPerSecond} tok/s`}{" "}
                      · {answer.seconds} s
                    </span>
                  ) : null}
                </div>
                <div className="max-h-64 overflow-auto text-sm whitespace-pre-wrap">
                  {answer.text.length > 0 ? answer.text : "No answer."}
                </div>
              </div>
            ))}
          </div>
          {revealed === null ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm">Which answer is better?</span>
              <Button size="xs" disabled={busy} onClick={() => void pick("A")}>
                A is better
              </Button>
              <Button size="xs" disabled={busy} onClick={() => void pick("B")}>
                B is better
              </Button>
              <Button size="xs" variant="outline" disabled={busy} onClick={() => void pick("tie")}>
                Tie
              </Button>
            </div>
          ) : (
            <p className="text-sm">
              {revealed.winner === null
                ? "You called it a tie."
                : `You picked ${nameOf(revealed.winner)}.`}{" "}
              <span className="text-muted-foreground">The pick is saved on this computer.</span>
            </p>
          )}
        </>
      ) : null}
    </div>
  );
}
