import type {
  ContentPairingAcceptInput,
  ContentPairingAcceptResult,
  ContentPairingCode,
} from "@t3tools/contracts";
import { useState } from "react";

import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogDescription,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
} from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import { Textarea } from "~/components/ui/textarea";

type PairingInput = Omit<ContentPairingAcceptInput, "workspaceId">;
/** The result, or the server's own words when it refused. */
export type PairingStartFn = () => Promise<ContentPairingCode | string>;
export type PairingAcceptFn = (input: PairingInput) => Promise<ContentPairingAcceptResult | string>;

const formatTime = (iso: string) =>
  new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

function PairForm(props: { readonly start: PairingStartFn; readonly accept: PairingAcceptFn }) {
  const [code, setCode] = useState<ContentPairingCode | null>(null);
  const [blob, setBlob] = useState("");
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [paired, setPaired] = useState<string | null>(null);

  const make = async () => {
    setBusy(true);
    setProblem(null);
    const result = await props.start();
    setBusy(false);
    if (typeof result === "string") setProblem(result);
    else setCode(result);
  };
  const pair = async () => {
    setBusy(true);
    setProblem(null);
    setPaired(null);
    const result = await props.accept({ blob: blob.trim(), pin: pin.trim() });
    setBusy(false);
    if (typeof result === "string") {
      setProblem(result);
      return;
    }
    setPaired(
      result.replacedKey
        ? "Paired. Approvals made on this computer before now show as unsigned. Approve them again."
        : "Paired.",
    );
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>Pair another computer</DialogTitle>
        <DialogDescription>
          Two paired computers check each other's approvals. Send the code and tell the PIN by
          different routes.
        </DialogDescription>
      </DialogHeader>
      <DialogPanel>
        <div className="grid gap-6">
          <section className="grid gap-2" aria-label="Make a code">
            <h3 className="font-medium text-sm">On the computer that has the approvals</h3>
            <div>
              <Button size="sm" disabled={busy} onClick={() => void make()}>
                Make a code
              </Button>
            </div>
            {code ? (
              <div className="grid gap-2">
                <Textarea aria-label="Code to copy" readOnly rows={3} value={code.blob} />
                <p className="text-sm">
                  PIN:{" "}
                  <strong aria-label="PIN to tell" className="font-mono text-base tracking-wider">
                    {code.pin}
                  </strong>
                </p>
                <p className="text-muted-foreground text-xs">
                  The code stops working at {formatTime(code.expiresAt)} and works one time.
                </p>
              </div>
            ) : null}
          </section>
          <section className="grid gap-2" aria-label="Enter a code">
            <h3 className="font-medium text-sm">On the new computer</h3>
            <Textarea
              aria-label="Code from the other computer"
              rows={3}
              placeholder="Paste the code"
              value={blob}
              onChange={(event) => setBlob(event.target.value)}
            />
            <Input
              aria-label="PIN from the other computer"
              placeholder="PIN, like 7K3M-9QXP"
              value={pin}
              onChange={(event) => setPin(event.target.value)}
            />
            <div>
              <Button
                size="sm"
                disabled={busy || blob.trim() === "" || pin.trim() === ""}
                onClick={() => void pair()}
              >
                Pair this computer
              </Button>
            </div>
            {paired ? (
              <p role="status" className="text-sm">
                {paired}
              </p>
            ) : null}
          </section>
          {problem ? (
            <p role="alert" className="text-destructive-foreground text-sm">
              {problem}
            </p>
          ) : null}
        </div>
      </DialogPanel>
    </>
  );
}

/** A quiet link at the foot of the screen. The caller shows it only to a person who may write. */
export function PairComputer(props: {
  readonly start: PairingStartFn;
  readonly accept: PairingAcceptFn;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button size="xs" variant="ghost-muted" className="self-start" onClick={() => setOpen(true)}>
        Pair another computer
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogPopup>
          {open ? <PairForm start={props.start} accept={props.accept} /> : null}
        </DialogPopup>
      </Dialog>
    </>
  );
}
