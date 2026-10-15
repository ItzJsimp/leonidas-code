import { useAtomValue } from "@effect/atom-react";
import { GROQ_KEY_PATTERN, type EnvironmentId } from "@t3tools/contracts";
import { useEffect, useRef, useState } from "react";
import { squashAtomCommandFailure } from "@t3tools/client-runtime/state/runtime";
import { serverEnvironment } from "../../state/server";
import { useAtomCommand } from "../../state/use-atom-command";
import { Button } from "../ui/button";
import { Input } from "../ui/input";

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
  const pending = useRef(false);
  const allowed = useAtomValue(serverEnvironment.setVoiceKey.permissionAtom(environmentId));
  const save = useAtomCommand(serverEnvironment.setVoiceKey, { reportFailure: false });
  const saveKey = async (value: string) => {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError("");
    const result = await save({ environmentId, input: { key: value } });
    setKey("");
    setBusy(false);
    pending.current = false;
    if (result._tag === "Success") {
      setWatchClipboard(false);
      onReady();
    } else if (result._tag === "Failure") {
      const failure = squashAtomCommandFailure(result);
      setError(
        failure instanceof Error ? failure.message : "The key could not be saved. Try again.",
      );
    }
  };
  const currentSave = useRef(saveKey);
  useEffect(() => {
    currentSave.current = saveKey;
  }, [saveKey]);
  useEffect(() => {
    if (!watchClipboard || !allowed) return;
    let disposed = false;
    const capture = async () => {
      try {
        const value = (await navigator.clipboard.readText()).trim();
        if (!disposed && GROQ_KEY_PATTERN.test(value)) await currentSave.current(value);
      } catch {
        // Browsers may require an explicit paste. The password field stays available.
      }
    };
    window.addEventListener("focus", capture);
    return () => {
      disposed = true;
      window.removeEventListener("focus", capture);
    };
  }, [watchClipboard, allowed]);
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Speak your prompts. Groq converts your recording to text and cleans up punctuation.
      </p>
      <ol className="list-decimal space-y-2 pl-5 text-sm">
        <li>
          <a
            href="https://console.groq.com/keys"
            target="_blank"
            rel="noreferrer"
            className="underline"
            onClick={() => setWatchClipboard(true)}
          >
            Open Groq
          </a>{" "}
          and sign in or create an account.
        </li>
        <li>Select Create API Key, then copy the key. Groq shows it once.</li>
        <li>Paste your key below. Leonidas checks it before saving.</li>
      </ol>
      {watchClipboard && (
        <p role="status" className="text-sm text-muted-foreground">
          Copy the key, then return here. If clipboard access is available, Leonidas saves it
          automatically.
        </p>
      )}
      <label className="block space-y-2 text-sm">
        Groq API key
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
        onClick={() => void saveKey(key)}
      >
        {busy ? "Checking key..." : "Enable voice"}
      </Button>
    </div>
  );
}
