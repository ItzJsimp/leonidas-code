import {
  isAtomCommandInterrupted,
  squashAtomCommandFailure,
  type AtomCommandResult,
} from "@t3tools/client-runtime/state/runtime";
import { useMemo, useState } from "react";

import { userErrorToastFields } from "~/lib/userErrorToast";
import { randomUUID } from "~/lib/utils";
import { useGitStackedAction, useVcsPullAction } from "~/state/sourceControlActions";
import { Button } from "../ui/button";
import { Textarea } from "../ui/textarea";
import { toastManager } from "../ui/toast";
import { actionLabels, getLatestGate, saveGate, sendGate } from "./gitActions.logic";
import type { LaneStatus, LaneStepId, WordsMode } from "./gitLane.logic";

type Scope = Parameters<typeof useGitStackedAction>[0];

/** The one button each lane step offers. Every action is a click; nothing runs alone. */
export function GitLaneActions(props: {
  readonly stepId: LaneStepId;
  readonly scope: Scope;
  readonly status: LaneStatus;
  readonly mode: WordsMode;
}) {
  const labels = actionLabels(props.mode);
  const { environmentId, cwd } = props.scope;
  const scope = useMemo(() => ({ environmentId, cwd }), [environmentId, cwd]);
  const stacked = useGitStackedAction(scope);
  const pull = useVcsPullAction(scope);
  const [message, setMessage] = useState("");
  const [composing, setComposing] = useState(false);
  const [confirmingMain, setConfirmingMain] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const fail = (
    title: string,
    result: Exclude<AtomCommandResult<unknown, unknown>, { _tag: "Success" }>,
  ) => {
    if (isAtomCommandInterrupted(result)) return;
    toastManager.add({
      type: "error",
      title,
      ...userErrorToastFields(squashAtomCommandFailure(result)),
    });
  };

  const save = async () => {
    setNote(null);
    const result = await stacked.run({
      actionId: randomUUID(),
      action: "commit",
      ...(message.trim() ? { commitMessage: message.trim() } : {}),
    });
    if (result._tag === "Success") {
      setComposing(false);
      setMessage("");
      setNote(result.value.toast.title);
    } else fail("Could not save", result);
  };

  const send = async () => {
    setNote(null);
    setConfirmingMain(false);
    const result = await stacked.run({ actionId: randomUUID(), action: "push" });
    if (result._tag === "Success") setNote(result.value.toast.title);
    else fail("Could not send", result);
  };

  const getLatest = async () => {
    setNote(null);
    const result = await pull.run();
    if (result._tag === "Success") {
      setNote(
        result.value.status === "pulled"
          ? "Done. You have the latest."
          : "You already have the latest.",
      );
    } else fail("Could not get latest", result);
  };

  const busy = stacked.isPending || pull.isPending;

  if (props.stepId === "working") {
    const gate = saveGate(props.status);
    return (
      <ActionRow help={labels.saveHelp} note={note ?? (gate.allowed ? null : gate.reason)}>
        {composing ? (
          <div className="flex w-full flex-col gap-2">
            <Textarea
              aria-label="Save message"
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              placeholder="Describe what you changed, or leave this blank and one is written for you."
              rows={3}
            />
            <div className="flex gap-2">
              <Button size="sm" disabled={busy} onClick={save}>
                {labels.save}
              </Button>
              <Button size="sm" variant="ghost" disabled={busy} onClick={() => setComposing(false)}>
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <Button size="sm" disabled={!gate.allowed || busy} onClick={() => setComposing(true)}>
            {labels.save}
          </Button>
        )}
      </ActionRow>
    );
  }

  if (props.stepId === "saved") {
    const gate = sendGate(props.status);
    return (
      <ActionRow help={labels.sendHelp} note={note ?? (gate.allowed ? null : gate.reason)}>
        {confirmingMain ? (
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span>You are on main, the official copy. Send anyway?</span>
            <Button size="sm" disabled={busy} onClick={send}>
              Yes, send
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setConfirmingMain(false)}>
              Cancel
            </Button>
          </div>
        ) : (
          <Button
            size="sm"
            disabled={!gate.allowed || busy}
            onClick={() => (gate.allowed && gate.confirmMain ? setConfirmingMain(true) : send())}
          >
            {labels.send}
          </Button>
        )}
      </ActionRow>
    );
  }

  const gate = getLatestGate(props.status);
  return (
    <ActionRow help={labels.getLatestHelp} note={note ?? (gate.allowed ? null : gate.reason)}>
      <Button size="sm" disabled={!gate.allowed || busy} onClick={getLatest}>
        {labels.getLatest}
      </Button>
    </ActionRow>
  );
}

function ActionRow(props: {
  readonly help: string;
  readonly note: string | null;
  readonly children: React.ReactNode;
}) {
  return (
    <div className="mt-2 flex flex-col gap-1.5">
      <p className="text-xs text-muted-foreground">{props.help}</p>
      <div className="flex flex-wrap items-center gap-2">{props.children}</div>
      {props.note ? (
        <p role="status" className="text-sm text-muted-foreground">
          {props.note}
        </p>
      ) : null}
    </div>
  );
}
