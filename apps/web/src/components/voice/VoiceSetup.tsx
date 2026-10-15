import { useAtomValue } from "@effect/atom-react";
import { GROQ_KEY_PATTERN, type EnvironmentId } from "@t3tools/contracts";
import { useEffect, useEffectEvent, useRef, useState } from "react";
import { serverEnvironment } from "../../state/server";
import { useAtomCommand } from "../../state/use-atom-command";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { usePreviewAvailable } from "../../browser/previewRuntime";
import { GroqSetupBrowser } from "./GroqSetupBrowser";

export function VoiceSetup({
  environmentId,
  onReady,
}: {
  environmentId: EnvironmentId;
  onReady: () => void;
}) {
  const [key, setKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [watchClipboard, setWatchClipboard] = useState(false);
  const [clipboardHelp, setClipboardHelp] = useState("");
  const pending = useRef(false);
  const active = useRef(true);
  const openButton = useRef<HTMLButtonElement>(null);
  const allowed = useAtomValue(serverEnvironment.setVoiceKey.permissionAtom(environmentId));
  const browserAvailable = usePreviewAvailable(environmentId);
  const save = useAtomCommand(serverEnvironment.setVoiceKey, { reportFailure: false });
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  useEffect(() => {
    if (!allowed) setWatchClipboard(false);
  }, [allowed]);
  const saveKey = async (value: string) => {
    if (pending.current || !allowed || !active.current) return;
    if (!GROQ_KEY_PATTERN.test(value.trim())) {
      setError("This is not a Groq key. Copy the full key that starts with gsk_.");
      return;
    }
    pending.current = true;
    setBusy(true);
    setError("");
    try {
      const result = await save({ environmentId, input: { key: value.trim() } });
      if (!active.current) return;
      setKey("");
      if (result._tag === "Success") {
        setWatchClipboard(false);
        onReady();
      } else if (result._tag === "Failure") {
        setError("Groq could not accept this key. Copy a current key and try again.");
      }
    } catch {
      if (active.current)
        setError("The key could not be saved. Reconnect this computer and try again.");
    } finally {
      pending.current = false;
      if (active.current) setBusy(false);
    }
  };
  const acceptCopiedKey = (value: string) => {
    if (watchClipboard && allowed && GROQ_KEY_PATTERN.test(value.trim())) void saveKey(value);
  };
  const captureCopiedKey = useEffectEvent(acceptCopiedKey);
  useEffect(() => {
    if (!watchClipboard || !allowed) return;
    let disposed = false;
    let reading = false;
    let denied = false;
    const capture = async () => {
      if (disposed || reading || denied) return;
      reading = true;
      try {
        const value = (await navigator.clipboard.readText()).trim();
        if (!disposed) captureCopiedKey(value);
      } catch {
        denied = true;
        if (!disposed)
          setClipboardHelp("Clipboard access is blocked. Paste your key into the field below.");
      } finally {
        reading = false;
      }
    };
    window.addEventListener("focus", capture);
    // A desktop guest can copy without refocusing the parent window.
    const poll = setInterval(() => {
      if (document.hasFocus()) void capture();
    }, 1000);
    const timeout = setTimeout(() => setWatchClipboard(false), 10 * 60 * 1000);
    return () => {
      disposed = true;
      clearTimeout(timeout);
      clearInterval(poll);
      window.removeEventListener("focus", capture);
    };
  }, [watchClipboard, allowed]);
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Speak your prompts. Groq converts your recording to text and cleans up punctuation.
      </p>
      <div
        className={
          watchClipboard && allowed && browserAvailable
            ? "grid min-w-0 gap-4 md:grid-cols-[12rem_minmax(0,1fr)]"
            : "space-y-4"
        }
      >
        <div className="space-y-4">
          <ol aria-label="Voice setup checklist" className="list-decimal space-y-3 pl-5 text-sm">
            <li>Sign in to Groq or create an account.</li>
            <li>Select Create API Key, then copy the key. Groq shows it once.</li>
            <li>Leonidas checks and saves the key. Then test one sentence.</li>
          </ol>
          <Button
            ref={openButton}
            type="button"
            variant="outline"
            disabled={!allowed || busy}
            title="Open Groq and start key capture for this setup only"
            onClick={() => {
              setWatchClipboard(true);
              setClipboardHelp("");
            }}
          >
            Open Groq
          </Button>
          {watchClipboard && allowed && (
            <>
              <p role="status" className="text-sm text-muted-foreground">
                Key capture is on for this setup. Close Groq to stop it.
              </p>
              <Button
                type="button"
                variant="ghost"
                title="Close the setup browser and stop clipboard capture"
                onClick={() => {
                  openButton.current?.focus();
                  setWatchClipboard(false);
                }}
              >
                Close Groq
              </Button>
              <a
                href="https://console.groq.com/keys"
                target="_blank"
                rel="noreferrer"
                className="block text-sm underline"
              >
                Open in your browser
              </a>
            </>
          )}
        </div>
        {watchClipboard && allowed && browserAvailable && (
          <GroqSetupBrowser
            key={environmentId}
            environmentId={environmentId}
            onCopiedKey={acceptCopiedKey}
          />
        )}
      </div>
      {watchClipboard && !browserAvailable && (
        <p role="status" className="text-sm">
          The built-in browser is unavailable here. Use the browser link, then paste your key below.
        </p>
      )}
      {clipboardHelp && (
        <p role="status" className="text-sm">
          {clipboardHelp}
        </p>
      )}
      <label className="block space-y-2 text-sm">
        Groq API key (manual paste)
        <Input
          type="password"
          autoComplete="off"
          value={key}
          placeholder="gsk_..."
          disabled={busy || !allowed}
          onChange={(event) => setKey(event.target.value)}
        />
      </label>
      <p className="text-xs text-muted-foreground">
        Your key stays in this host computer's encrypted credential vault. Audio goes to Groq only
        when you record.
      </p>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      {!allowed && (
        <p role="status" className="text-sm">
          You need settings access on this computer to add a key.
        </p>
      )}
      <Button
        type="button"
        disabled={busy || !key.trim() || !allowed}
        title="Check your Groq key and save it in this computer's credential vault"
        onClick={() => void saveKey(key)}
      >
        {busy ? "Checking key..." : "Enable voice"}
      </Button>
    </div>
  );
}
