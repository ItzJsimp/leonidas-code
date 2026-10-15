import { ProviderDriverKind } from "@t3tools/contracts";
import { ArrowRightIcon, CheckIcon, TerminalIcon } from "lucide-react";
import { useEffect, useState } from "react";

import { CLAUDE_WINDOWS_INSTALL_COMMAND } from "../../../onboarding/providerReadiness.logic";
import { ProviderInstanceIcon } from "../../chat/ProviderInstanceIcon";
import { Button } from "../../ui/button";
import { ScrollArea } from "../../ui/scroll-area";
import type { SimPersona } from "./onboardingSim.logic";

// Same lines the real setup terminal runs: install only, or sign-in for "Use a terminal instead".
const INSTALL_COMMAND = CLAUDE_WINDOWS_INSTALL_COMMAND;
const LOGIN_COMMAND = "claude auth login";

/** Mirrors the real card layout in WelcomeWizard's AgentCard. */
function AgentRow({
  driver,
  name,
  detail,
  control,
}: {
  readonly driver: "codex" | "claudeAgent";
  readonly name: string;
  readonly detail: string;
  readonly control: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border bg-background px-4 py-4">
      <ProviderInstanceIcon
        driverKind={ProviderDriverKind.make(driver)}
        displayName={name}
        iconClassName="size-5"
      />
      <div className="min-w-0 flex-1">
        <span className="block text-sm font-medium text-foreground">{name}</span>
        <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{detail}</p>
      </div>
      <div className="shrink-0">{control}</div>
    </div>
  );
}

const ReadyBadge = () => (
  <span className="inline-flex items-center gap-1.5 text-xs font-medium text-success-foreground">
    <CheckIcon className="size-3.5" />
    Ready
  </span>
);

function SimBrowserPrompt({
  text,
  actionLabel,
  onDone,
}: {
  readonly text: string;
  readonly actionLabel: string;
  readonly onDone: () => void;
}) {
  return (
    <div
      data-sim-control
      className="mt-2 flex items-center justify-between gap-3 rounded-lg border border-dashed border-border px-3 py-2 text-xs text-muted-foreground"
    >
      <span>[Simulated] {text}</span>
      <Button size="xs" variant="outline" onClick={onDone}>
        {actionLabel}
      </Button>
    </div>
  );
}

type CodexState = "idle" | "setting-up" | "waiting" | "ready";

function CodexRow({
  initial,
  onExternal,
}: {
  readonly initial: CodexState;
  readonly onExternal: (label: string) => void;
}) {
  const [state, setState] = useState<CodexState>(initial);
  // The real flow opens the sign-in page by itself; the button is only a fallback.
  const [browserOpen, setBrowserOpen] = useState(false);
  useEffect(() => {
    if (state !== "setting-up") return;
    const timer = window.setTimeout(() => {
      setState("waiting");
      setBrowserOpen(true);
    }, 1500);
    return () => window.clearTimeout(timer);
  }, [state]);

  return (
    <div>
      <AgentRow
        driver="codex"
        name="Codex"
        detail={
          state === "ready"
            ? "Connected to ChatGPT."
            : state === "waiting"
              ? "Finish signing in with your browser."
              : state === "setting-up"
                ? "Setting up Codex…"
                : "Code with your ChatGPT subscription."
        }
        control={
          state === "ready" ? (
            <ReadyBadge />
          ) : state === "waiting" ? (
            <div className="flex items-center gap-1.5">
              <Button size="sm" variant="outline" onClick={() => setBrowserOpen(true)}>
                Open sign-in page
              </Button>
              <Button size="sm" variant="ghost-muted" onClick={() => setState("idle")}>
                Cancel
              </Button>
            </div>
          ) : (
            <Button
              size="sm"
              disabled={state === "setting-up"}
              onClick={() => setState("setting-up")}
            >
              {state === "setting-up" ? "Setting up..." : "Continue with ChatGPT"}
            </Button>
          )
        }
      />
      {state === "waiting" && browserOpen ? (
        <SimBrowserPrompt
          text="ChatGPT opened in your browser."
          actionLabel="Pretend I signed in"
          onDone={() => {
            onExternal("ChatGPT sign-in page in the browser (email, password, approve)");
            setState("ready");
          }}
        />
      ) : null}
    </div>
  );
}

type ClaudeState = "missing" | "needs-signin" | "waiting" | "ready";

function ClaudeRow({
  initial,
  onExternal,
}: {
  readonly initial: ClaudeState;
  readonly onExternal: (label: string) => void;
}) {
  const [state, setState] = useState<ClaudeState>(initial);
  const [terminal, setTerminal] = useState<"install" | "login" | null>(null);
  const [ran, setRan] = useState(false);
  const [approved, setApproved] = useState(false);
  // The real flow opens the sign-in page by itself; the button is only a fallback.
  const [browserOpen, setBrowserOpen] = useState(false);

  // Like the real setup terminal, it closes itself once the command has finished.
  // The install line only installs: the card then starts the browser sign-in by itself.
  // The secondary "Use a terminal instead" line signs in, so it finishes after approval.
  useEffect(() => {
    const finished = terminal === "install" ? ran : terminal === "login" && approved;
    if (!finished) return;
    const timer = window.setTimeout(() => {
      if (terminal === "install") {
        setState("waiting");
        setBrowserOpen(true);
      } else {
        setState("ready");
      }
      setTerminal(null);
    }, 900);
    return () => window.clearTimeout(timer);
  }, [terminal, ran, approved]);

  const open = (kind: "install" | "login") => {
    setTerminal(kind);
    setRan(false);
    setApproved(false);
  };
  const close = () => {
    if (approved) setState("ready");
    else if (terminal === "install" && ran) {
      setState("waiting");
      setBrowserOpen(true);
    }
    setTerminal(null);
  };

  return (
    <div>
      <AgentRow
        driver="claudeAgent"
        name="Claude Code"
        detail={
          state === "ready"
            ? "Ready to use."
            : state === "waiting"
              ? "Finish signing in with your browser."
              : state === "needs-signin"
                ? "Sign in to use your Claude plan."
                : "Claude Code is not installed. Select Install."
        }
        control={
          state === "ready" ? (
            <ReadyBadge />
          ) : state === "waiting" ? (
            <div className="flex items-center gap-1.5">
              <Button size="sm" variant="outline" onClick={() => setBrowserOpen(true)}>
                Open sign-in page
              </Button>
              <Button
                size="sm"
                variant="ghost-muted"
                onClick={() => {
                  setBrowserOpen(false);
                  setState("needs-signin");
                }}
              >
                Cancel
              </Button>
            </div>
          ) : state === "needs-signin" ? (
            <Button
              size="sm"
              disabled={terminal !== null}
              onClick={() => {
                setState("waiting");
                setBrowserOpen(true);
              }}
            >
              Sign in with Claude
            </Button>
          ) : (
            <Button
              size="xs"
              variant="ghost"
              disabled={terminal !== null}
              onClick={() => open("install")}
            >
              <TerminalIcon className="size-3.5" />
              Install
            </Button>
          )
        }
      />
      {state === "needs-signin" && terminal === null ? (
        <button
          type="button"
          data-sim-control
          className="mt-1 ml-12 text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
          onClick={() => open("login")}
        >
          Use a terminal instead
        </button>
      ) : null}
      {state === "waiting" && browserOpen ? (
        <SimBrowserPrompt
          text="Claude opened in your browser."
          actionLabel="Pretend I approved"
          onDone={() => {
            onExternal("Claude sign-in page in the browser (log in, approve access)");
            setBrowserOpen(false);
            setState("ready");
          }}
        />
      ) : null}
      {terminal !== null ? (
        <div className="mt-2 overflow-hidden rounded-lg border border-border/70 bg-background">
          <div className="flex items-center justify-between border-b border-border/60 px-3 py-1.5">
            <span className="text-2xs font-medium text-muted-foreground">
              {ran
                ? "The command is running."
                : "Run this command when you are ready. Nothing runs until you do."}
            </span>
            <div className="flex items-center gap-1">
              {ran ? null : (
                <Button size="xs" variant="ghost" onClick={() => setRan(true)}>
                  Run
                </Button>
              )}
              <Button size="xs" variant="ghost-muted" onClick={close}>
                Close
              </Button>
            </div>
          </div>
          <div
            tabIndex={0}
            ref={(node) => node?.focus()}
            className="h-24 px-3 py-2 font-mono text-xs outline-none"
            onKeyDown={(event) => {
              if (event.key === "Enter") setRan(true);
            }}
          >
            <div>{`> ${terminal === "install" ? INSTALL_COMMAND : LOGIN_COMMAND}`}</div>
            {ran ? (
              <div className="mt-1 text-muted-foreground">
                {terminal === "install"
                  ? "Downloading and installing Claude Code… done. Opening the sign-in page next…"
                  : "Opening your browser to sign in…"}
              </div>
            ) : null}
          </div>
          {terminal === "login" && ran && !approved ? (
            <div className="px-3 pb-3">
              <SimBrowserPrompt
                text="Claude sign-in opened in your browser."
                actionLabel="Pretend I approved"
                onDone={() => {
                  onExternal("Claude sign-in page in the browser (log in, approve access)");
                  setApproved(true);
                }}
              />
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export function SimAgentsStep({
  persona,
  onExternal,
  onBack,
  onContinue,
}: {
  readonly persona: SimPersona;
  readonly onExternal: (label: string) => void;
  readonly onBack: () => void;
  readonly onContinue: () => void;
}) {
  const veteran = persona === "veteran";
  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight text-foreground">
        Add your AI accounts
      </h1>
      <p className="mt-2.5 text-sm leading-relaxed text-muted-foreground">
        You only need one AI account to start. You can add more later.
      </p>
      <ScrollArea scrollFade className="mt-5 h-auto max-h-[min(32rem,55dvh)]">
        <div className="space-y-1.5 pr-3">
          <CodexRow initial={veteran ? "ready" : "idle"} onExternal={onExternal} />
          <ClaudeRow initial={veteran ? "ready" : "missing"} onExternal={onExternal} />
        </div>
      </ScrollArea>
      <div className="mt-6 flex items-center justify-between">
        <Button variant="ghost-muted" onClick={onBack}>
          Back
        </Button>
        <Button autoFocus onClick={onContinue}>
          Continue
          <ArrowRightIcon className="size-3.5" />
        </Button>
      </div>
    </>
  );
}
