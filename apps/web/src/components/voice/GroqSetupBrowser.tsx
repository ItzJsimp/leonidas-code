import { scopeThreadRef } from "@t3tools/client-runtime/environment";
import { ThreadId, type EnvironmentId, type ScopedThreadRef } from "@t3tools/contracts";
import { lazy, Suspense, useEffect, useState } from "react";
import { previewEnvironment } from "../../state/preview";
import { useAtomCommand } from "../../state/use-atom-command";
import { openPreviewSession } from "../preview/openPreviewSession";
import { randomUUID } from "../../lib/utils";

const PreviewView = lazy(() =>
  import("../preview/PreviewView").then((module) => ({ default: module.PreviewView })),
);

/** Own every tab, including sign-in popups, only while voice setup is open. */
export function GroqSetupBrowser({
  environmentId,
  onCopiedKey,
}: {
  environmentId: EnvironmentId;
  onCopiedKey: (text: string) => void;
}) {
  const open = useAtomCommand(previewEnvironment.open, { reportFailure: false });
  const close = useAtomCommand(previewEnvironment.close);
  const [threadRef, setThreadRef] = useState<ScopedThreadRef | null>(null);
  const [state, setState] = useState<"opening" | "ready" | "failed">("opening");
  useEffect(() => {
    let disposed = false;
    // Each effect generation has separate ownership, including Strict Mode remounts.
    const threadId = ThreadId.make(`voice-setup-${randomUUID()}`);
    const ref = scopeThreadRef(environmentId, threadId);
    const opening = openPreviewSession({
      openPreview: open,
      threadRef: ref,
      url: "https://console.groq.com/keys",
      viewport: { _tag: "fill" },
    });
    void opening
      .then((result) => {
        if (!disposed) {
          setThreadRef(ref);
          setState(result._tag === "Success" ? "ready" : "failed");
        }
      })
      .catch(() => {
        if (!disposed) setState("failed");
      });
    return () => {
      disposed = true;
      // Await an in-flight open so closing cannot leave a late tab behind.
      void opening
        .finally(() => close({ environmentId, input: { threadId } }))
        .catch(() => undefined);
    };
  }, [close, environmentId, open]);
  return (
    <section
      aria-label="Groq setup browser"
      className="flex h-96 min-w-0 flex-col overflow-hidden rounded-lg border bg-background"
    >
      {state === "ready" && threadRef ? (
        <Suspense
          fallback={
            <p role="status" className="p-4 text-sm">
              Loading Groq browser...
            </p>
          }
        >
          <PreviewView threadRef={threadRef} visible onClipboard={onCopiedKey} />
        </Suspense>
      ) : (
        <p
          role={state === "failed" ? "alert" : "status"}
          className="p-4 text-sm text-muted-foreground"
        >
          {state === "failed"
            ? "The built-in browser could not open. Open Groq in your browser, then paste the key below."
            : "Opening Groq... Sign in and create your own key."}
        </p>
      )}
    </section>
  );
}
