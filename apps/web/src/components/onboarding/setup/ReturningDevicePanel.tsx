import { CheckIcon } from "lucide-react";
import { useState, type ReactNode } from "react";

import { Button } from "../../ui/button";
import { Input } from "../../ui/input";
import { Spinner } from "../../ui/spinner";

/**
 * Screen 1 for people who already use Leonidas elsewhere: copy the AIOS from GitHub, and link
 * to the other computer to see its chats live. Both parts are optional.
 */
export function ReturningDevicePanel({
  folder,
  cloneAios,
  pairingForm,
  onBack,
  onDone,
}: {
  /** Where the AIOS goes on this computer. */
  readonly folder: string;
  /** Resolves to an error message, or null when the AIOS was copied. */
  readonly cloneAios: (url: string) => Promise<string | null>;
  readonly pairingForm: ReactNode;
  readonly onBack: () => void;
  /** Gets whether the AIOS was copied, so setup can skip the questions it already answers. */
  readonly onDone: (cloned: boolean) => void;
}) {
  const [url, setUrl] = useState("");
  const [cloning, setCloning] = useState(false);
  const [cloned, setCloned] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clone = async () => {
    setCloning(true);
    setError(null);
    const failure = await cloneAios(url.trim()).catch(() => "Could not copy the AIOS. Try again.");
    setCloning(false);
    if (failure === null) setCloned(true);
    else setError(failure);
  };

  return (
    <div className="flex flex-1 flex-col gap-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Bring your Leonidas here</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Do one or both. You can also do them later in Settings.
        </p>
      </div>
      <section className="space-y-2 rounded-lg border bg-card p-4">
        <h2 className="text-sm font-medium">1. Copy your AIOS from GitHub</h2>
        <p className="text-xs text-muted-foreground">
          Paste the link to your AIOS on GitHub. It goes to {folder}.
        </p>
        {cloned ? (
          <p className="flex items-center gap-1.5 text-sm text-success-foreground" role="status">
            <CheckIcon className="size-4" />
            Your AIOS is on this computer.
          </p>
        ) : (
          <div className="flex gap-2">
            <Input
              aria-label="GitHub link to your AIOS"
              spellCheck={false}
              placeholder="https://github.com/you/your-aios"
              value={url}
              readOnly={cloning}
              onChange={(event) => setUrl(event.currentTarget.value)}
            />
            <Button
              type="button"
              disabled={cloning || url.trim() === ""}
              onClick={() => void clone()}
            >
              {cloning ? <Spinner /> : null}
              Get my AIOS
            </Button>
          </div>
        )}
        {error ? (
          <p role="alert" className="text-xs text-destructive-foreground">
            {error}
          </p>
        ) : null}
      </section>
      <section className="space-y-2 rounded-lg border bg-card p-4">
        <h2 className="text-sm font-medium">2. See your chats from the other computer, live</h2>
        <p className="text-xs text-muted-foreground">
          On the other computer, open Settings, then Connections. Under Devices that can connect,
          click Create link. Paste that link here. Both computers must be on the same network or the
          same Tailscale account.
        </p>
        {pairingForm}
      </section>
      <div className="mt-auto flex items-center justify-between gap-3 pt-2">
        <Button type="button" variant="ghost" onClick={onBack}>
          Back
        </Button>
        <Button type="button" onClick={() => onDone(cloned)}>
          Continue
        </Button>
      </div>
    </div>
  );
}
