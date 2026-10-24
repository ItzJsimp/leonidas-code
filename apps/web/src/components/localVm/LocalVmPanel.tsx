import { useAtomValue } from "@effect/atom-react";
import type {
  EnvironmentId,
  ThreadId,
  LocalVmState,
  LocalVmScreenshotResult,
} from "@t3tools/contracts";
import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { Button } from "~/components/ui/button";
import { localVmEnvironment } from "~/state/localVm";
import { useAtomCommand } from "~/state/use-atom-command";
import { formatEnvironmentQueryError } from "~/state/query";

/** Nonmodal guest viewer: the user can keep chatting while watching AI input. Opened from the chat title menu. */
export function LocalVmPanel({
  environmentId,
  threadId,
  onClose,
}: {
  environmentId: EnvironmentId;
  threadId: ThreadId;
  onClose: () => void;
}) {
  const list = useAtomCommand(localVmEnvironment.list, { reportFailure: false });
  const screenshot = useAtomCommand(localVmEnvironment.screenshot, { reportFailure: false });
  const connect = useAtomCommand(localVmEnvironment.connect, { reportFailure: false });
  const pause = useAtomCommand(localVmEnvironment.pause, { reportFailure: false });
  const release = useAtomCommand(localVmEnvironment.release, { reportFailure: false });
  const canConnect = useAtomValue(localVmEnvironment.connect.permissionAtom(environmentId));
  const canPause = useAtomValue(localVmEnvironment.pause.permissionAtom(environmentId));
  const canRelease = useAtomValue(localVmEnvironment.release.permissionAtom(environmentId));
  const [state, setState] = useState<LocalVmState | null>(null);
  const [shot, setShot] = useState<LocalVmScreenshotResult | null>(null);
  const [selected, setSelected] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [operationError, setOperationError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const session = state?.sessions.find((s) => s.threadId === threadId);
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const observe = async () => {
      if (document.visibilityState === "visible") {
        const result = await list({ environmentId, input: {} });
        if (cancelled) return;
        if (result._tag === "Failure") setError(formatEnvironmentQueryError(result.cause));
        else {
          setState(result.value);
          const current = result.value.sessions.find((s) => s.threadId === threadId);
          if (current) {
            const image = await screenshot({ environmentId, input: { threadId } });
            if (cancelled) return;
            if (image._tag === "Success") {
              setShot(image.value);
              setError(null);
            } else {
              setShot(null);
              setError(formatEnvironmentQueryError(image.cause));
            }
          } else {
            setShot(null);
            setError(null);
          }
        }
      }
      if (!cancelled) timer = setTimeout(observe, 2000);
    };
    void observe();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [environmentId, threadId, list, screenshot]);
  const mutate = async (operation: "connect" | "pause" | "release") => {
    setBusy(true);
    setOperationError(null);
    const result =
      operation === "connect"
        ? await connect({ environmentId, input: { threadId, vmId: selected } })
        : operation === "pause"
          ? await pause({ environmentId, input: { threadId, paused: !session?.paused } })
          : await release({ environmentId, input: { threadId } });
    if (result._tag === "Failure") setOperationError(formatEnvironmentQueryError(result.cause));
    else {
      setError(null);
      const current = await list({ environmentId, input: {} });
      if (current._tag === "Success") {
        setState(current.value);
        setShot(null);
      } else setError(formatEnvironmentQueryError(current.cause));
    }
    setBusy(false);
  };
  return (
    <aside
      aria-label="AI Desktop"
      className="fixed right-3 bottom-52 top-16 z-30 flex w-[min(36rem,calc(100vw-1.5rem))] flex-col gap-4 overflow-auto rounded-xl border border-border bg-background p-4 shadow-xl"
    >
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold">AI Desktop</h2>
          <p className="text-xs text-muted-foreground">
            A virtual Windows computer on this computer
          </p>
        </div>
        <Button variant="ghost" size="icon" aria-label="Hide AI Desktop" onClick={onClose}>
          <X />
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Connect a running virtual Windows computer. Then the AI can control it for this chat. Your
        own mouse stays yours. If you hide this window, the connection stays on.
      </p>
      {!state && !error && <p role="status">Looking for VirtualBox on this computer…</p>}
      {state && !state.available && <p role="status">{state.reason}</p>}
      {state?.available && !session && (
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex min-w-0 flex-1 flex-col gap-1 text-xs">
            Virtual computer
            <select
              aria-label="Virtual computer"
              className="rounded-md border border-input bg-background p-2 text-sm"
              value={selected}
              onChange={(e) => setSelected(e.target.value)}
              disabled={busy}
            >
              <option value="">Choose a running virtual computer</option>
              {state.vms.map((vm) => (
                <option
                  key={vm.id}
                  value={vm.id}
                  disabled={
                    !vm.running ||
                    state.sessions.some((s) => s.vmId === vm.id && s.threadId !== threadId)
                  }
                >
                  {vm.name}
                  {!vm.running
                    ? " (stopped)"
                    : state.sessions.some((s) => s.vmId === vm.id && s.threadId !== threadId)
                      ? " (in use)"
                      : ""}
                </option>
              ))}
            </select>
          </label>
          <Button
            size="sm"
            disabled={busy || !selected || !canConnect}
            onClick={() => void mutate("connect")}
          >
            Connect and let the AI control it
          </Button>
        </div>
      )}
      {session && (
        <div className="flex flex-wrap items-center gap-2">
          <p className="min-w-0 flex-1 text-sm" role="status">
            {state?.vms.find((v) => v.id === session.vmId)?.name ?? "Virtual computer"}:{" "}
            {session.paused ? "AI control paused" : "AI control on"}
          </p>
          <Button
            variant="outline"
            size="sm"
            disabled={busy || !canPause}
            onClick={() => void mutate("pause")}
          >
            {session.paused ? "Resume AI control" : "Pause AI control"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={busy || !canRelease}
            onClick={() => void mutate("release")}
          >
            Disconnect
          </Button>
        </div>
      )}
      {(operationError ?? error) && (
        <p role="alert" className="text-sm text-destructive">
          {operationError ?? error}
        </p>
      )}
      {shot && (
        <div className="flex min-h-0 flex-1 flex-col gap-2">
          <img
            className="min-h-0 w-full flex-1 object-contain"
            src={`data:image/png;base64,${shot.screenshot.data}`}
            alt="Current screen of the virtual computer"
          />
          <p className="text-xs text-muted-foreground">
            {shot.screenshot.width} x {shot.screenshot.height}. The picture updates every 2 seconds
            while you can see it.
          </p>
        </div>
      )}
      {state?.available && state.vms.length === 0 && (
        <p>No virtual computers found. In VirtualBox, create a Windows one and start it first.</p>
      )}
      <p className="text-xs text-muted-foreground">
        You need VirtualBox and your own copy of Windows with a license. Leonidas does not set it up
        for you.
      </p>
    </aside>
  );
}
