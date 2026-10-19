import { useAtomValue } from "@effect/atom-react";
import { GROQ_KEY_PATTERN, type EnvironmentId } from "@t3tools/contracts";
import { CheckCircle2Icon } from "lucide-react";
import { useEffect, useEffectEvent, useRef, useState } from "react";
import { ensureLocalApi } from "../../localApi";
import { serverEnvironment } from "../../state/server";
import { useAtomCommand } from "../../state/use-atom-command";
import { Button } from "../ui/button";
import { Input } from "../ui/input";

const GROQ_KEYS_URL = "https://console.groq.com/keys";

export function VoiceSetup({
  environmentId,
  onReady,
}: {
  environmentId: EnvironmentId;
  onReady: () => void;
}) {
  const [key, setKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [watchClipboard, setWatchClipboard] = useState(false);
  const [clipboardHelp, setClipboardHelp] = useState("");
  const pending = useRef(false);
  const active = useRef(true);
  const allowed = useAtomValue(serverEnvironment.setVoiceKey.permissionAtom(environmentId));
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
      if (result._tag === "Success") {
        setKey("");
        setWatchClipboard(false);
        setSaved(true);
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
  // A copied key fills the field. The user still clicks Enable voice to save it.
  const fillCopiedKey = (value: string) => {
    if (GROQ_KEY_PATTERN.test(value.trim())) {
      setKey(value.trim());
      setError("");
      setWatchClipboard(false);
    }
  };
  const captureCopiedKey = useEffectEvent(fillCopiedKey);
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
    const timeout = setTimeout(() => setWatchClipboard(false), 10 * 60 * 1000);
    return () => {
      disposed = true;
      clearTimeout(timeout);
      window.removeEventListener("focus", capture);
    };
  }, [watchClipboard, allowed]);
  if (saved) {
    return (
      <div className="space-y-4" role="status">
        <p className="flex items-center gap-2 text-sm font-medium">
          <CheckCircle2Icon aria-hidden className="size-5 text-success" />
          Voice is on. Press the mic button and speak.
        </p>
        <Button type="button" onClick={onReady}>
          Done
        </Button>
      </div>
    );
  }
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Speak your prompts. Groq converts your recording to text. Groq is free to start.
      </p>
      <ol aria-label="Voice setup checklist" className="list-decimal space-y-3 pl-5 text-sm">
        <li>
          Click <strong>Open Groq</strong> below. It opens in your normal browser. Sign in or create
          an account.
        </li>
        <li>
          Click <strong>Create API Key</strong>. Name it <strong>Leonidas</strong>. Set expiration
          to <strong>No expiration</strong>. Click <strong>Submit</strong>.
        </li>
        <li>
          Click <strong>Copy</strong>. Groq shows the key only once.
        </li>
        <li>
          Come back here. Paste the key in the box. Click <strong>Enable voice</strong>.
        </li>
      </ol>
      <Button
        type="button"
        variant="outline"
        disabled={!allowed || busy}
        onClick={() => {
          setWatchClipboard(true);
          setClipboardHelp("");
          void ensureLocalApi().shell.openExternal(GROQ_KEYS_URL);
        }}
      >
        Open Groq
      </Button>
      <p className="text-xs text-muted-foreground">
        Create API Key greyed out? Groq needs an organization first. Create one in Groq, or ask the
        owner of your team for the Developer role.
      </p>
      {clipboardHelp && (
        <p role="status" className="text-sm">
          {clipboardHelp}
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
        title="Check your Groq key and save it in this computer's credential vault"
        onClick={() => void saveKey(key)}
      >
        {busy ? "Checking key..." : "Enable voice"}
      </Button>
    </div>
  );
}
