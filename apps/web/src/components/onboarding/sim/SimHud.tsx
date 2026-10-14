import { useState } from "react";

import { Button } from "../../ui/button";
import {
  clicksInStep,
  SIM_STEP_LABELS,
  totalKeys,
  type SimNote,
  type SimRun,
} from "./onboardingSim.logic";

/**
 * Live counter for the simulation. Everything inside is marked `data-sim-hud`
 * so it never counts as a click or keystroke of the user being simulated.
 * Dictate or type an improvement into the box and press Enter to pin it to
 * the current step and click count.
 */
export function SimHud({
  run,
  onNote,
  onRestart,
  onExit,
}: {
  readonly run: SimRun;
  readonly onNote: (text: string) => void;
  readonly onRestart: () => void;
  readonly onExit: () => void;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [draft, setDraft] = useState("");
  const recent: readonly SimNote[] = run.notes.slice(-3);

  const submit = () => {
    const text = draft.trim();
    if (text.length === 0) return;
    onNote(text);
    setDraft("");
  };

  return (
    <div
      data-sim-hud
      className="fixed right-4 bottom-4 z-[2000] w-60 rounded-xl border border-border bg-popover p-3 text-popover-foreground shadow-lg"
    >
      <button
        type="button"
        className="flex w-full items-baseline justify-between text-left"
        onClick={() => setCollapsed((value) => !value)}
      >
        <span className="text-xs font-semibold tracking-wide uppercase">Simulation</span>
        <span className="text-xs text-muted-foreground">{collapsed ? "show" : "hide"}</span>
      </button>
      <div className="mt-2 flex items-end gap-4">
        <div>
          <div className="text-3xl font-semibold tabular-nums">{run.clicks.length}</div>
          <div className="text-2xs text-muted-foreground">clicks total</div>
        </div>
        <div>
          <div className="text-xl font-medium tabular-nums">{clicksInStep(run, run.step)}</div>
          <div className="text-2xs text-muted-foreground">{SIM_STEP_LABELS[run.step]}</div>
        </div>
        <div>
          <div className="text-xl font-medium tabular-nums">{totalKeys(run)}</div>
          <div className="text-2xs text-muted-foreground">keystrokes</div>
        </div>
      </div>
      {collapsed ? null : (
        <>
          <textarea
            rows={2}
            className="mt-3 w-full resize-none rounded-md border border-border bg-background px-2 py-1.5 text-xs outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
            placeholder="Say or type an improvement, then Enter"
            value={draft}
            onChange={(event) => setDraft(event.currentTarget.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                submit();
              }
            }}
          />
          {recent.length > 0 ? (
            <ul className="mt-2 space-y-1">
              {recent.map((note) => (
                <li key={note.at} className="text-2xs leading-snug text-muted-foreground">
                  <span className="font-medium text-foreground">{SIM_STEP_LABELS[note.step]}:</span>{" "}
                  {note.text}
                </li>
              ))}
            </ul>
          ) : null}
          <div className="mt-3 flex flex-wrap gap-1.5">
            <Button size="xs" variant="ghost" onClick={onRestart}>
              Restart
            </Button>
            <Button size="xs" variant="ghost" onClick={onExit}>
              Exit
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
