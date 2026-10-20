import { useLocation } from "@tanstack/react-router";
import { useMemo, useState } from "react";

import { buildStuckReport, sendStuckReport } from "~/lib/community/stuckReport";
import { Button } from "../ui/button";
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
} from "../ui/dialog";
import { toastManager } from "../ui/toast";
import { closeStuck, useStuckStore } from "./stuckStore";

/** Mounted once at the app root. Shows exactly what a report holds before anything is sent. */
export function StuckDialogHost() {
  const source = useStuckStore((state) => state.source);
  return (
    <Dialog open={source !== null} onOpenChange={(open) => (open ? undefined : closeStuck())}>
      <DialogPopup className="sm:max-w-md">
        {source ? <StuckForm source={source} /> : null}
      </DialogPopup>
    </Dialog>
  );
}

const LABELS: ReadonlyArray<readonly [keyof ReturnType<typeof buildStuckReport>, string]> = [
  ["screen", "Screen"],
  ["lastAction", "Last action"],
  ["errorCode", "Error type"],
  ["provider", "AI service"],
  ["appVersion", "App version"],
  ["platform", "System"],
];

function StuckForm({ source }: { source: "button" | "voice" }) {
  const pathname = useLocation({ select: (location) => location.pathname });
  const report = useMemo(() => buildStuckReport({ pathname, source }), [pathname, source]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const send = async () => {
    setSending(true);
    const result = await sendStuckReport(report);
    setSending(false);
    if (!result.ok) return setError(result.error);
    closeStuck();
    toastManager.add({
      type: "success",
      title: "Report sent",
      description: "Thanks. When it is fixed, this app tells you.",
    });
  };
  return (
    <>
      <DialogHeader>
        <DialogTitle>Stuck? Send us a report</DialogTitle>
        <DialogDescription>
          We see only the details below. We never see your messages, files or keys.
        </DialogDescription>
      </DialogHeader>
      <DialogPanel>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
          {LABELS.map(([key, label]) => (
            <div key={key} className="contents">
              <dt className="text-muted-foreground">{label}</dt>
              <dd>{report[key] ?? "none"}</dd>
            </div>
          ))}
        </dl>
        {error ? <p className="mt-3 text-sm text-destructive-foreground">{error}</p> : null}
      </DialogPanel>
      <DialogFooter>
        <Button variant="outline" onClick={closeStuck}>
          Cancel
        </Button>
        <Button disabled={sending} onClick={() => void send()}>
          {sending ? "Sending..." : "Send report"}
        </Button>
      </DialogFooter>
    </>
  );
}
