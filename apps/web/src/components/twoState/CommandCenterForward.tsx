import { scopeThreadRef } from "@t3tools/client-runtime/environment";
import { useNavigate } from "@tanstack/react-router";
import { ArrowUpIcon, FolderIcon } from "lucide-react";
import { type FormEvent, useState } from "react";

import { Spinner } from "~/components/ui/spinner";
import { Tip } from "./Tip";
import { useActiveAiosWorkspace } from "~/components/workspace/useActiveAiosWorkspace";
import { useOnboardingChat } from "~/onboarding/useOnboardingChat";
import { buildThreadRouteParams } from "~/threadRoutes";

import { greetingFor, statusLine } from "./copy";
import { useAiosHome, useTwoStateCounts } from "./useTwoStateData";

const TITLE_LENGTH = 60;

/** State 1: the greeting, one status line and the Ask composer. */
export function CommandCenterForward() {
  const counts = useTwoStateCounts();
  return (
    <div className="grid gap-5">
      <div>
        <h1 className="font-display text-3xl leading-tight font-semibold tracking-tight">
          {greetingFor(new Date())}
        </h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          {statusLine(counts).map((part, index) => (
            <span
              key={part.text}
              className={part.strong ? "font-medium text-foreground" : undefined}
            >
              {index > 0 ? " " : null}
              {part.text}
            </span>
          ))}
        </p>
      </div>
      <AskComposer />
    </div>
  );
}

/** Sending starts a chat in the AIOS folder and brings Code forward. */
function AskComposer() {
  const workspace = useActiveAiosWorkspace();
  const root = useAiosHome().data?.root ?? null;
  const { canOperate, ensureFolderProject, startChat } = useOnboardingChat(
    workspace.environmentId ?? undefined,
  );
  const navigate = useNavigate();
  const [prompt, setPrompt] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ready = root !== null && canOperate && workspace.environmentId;
  const text = prompt.trim();

  const send = async (event: FormEvent) => {
    event.preventDefault();
    if (!ready || text === "" || sending) return;
    setSending(true);
    setError(null);
    const project = await ensureFolderProject(root);
    const chat = project.ok
      ? await startChat({
          projectId: project.projectId,
          title: text.slice(0, TITLE_LENGTH),
          prompt: text,
        })
      : project;
    setSending(false);
    if (!chat.ok) {
      setError(chat.message);
      return;
    }
    setPrompt("");
    await navigate({
      to: "/$environmentId/$threadId",
      params: buildThreadRouteParams(scopeThreadRef(workspace.environmentId!, chat.threadId)),
    });
  };

  return (
    <form
      onSubmit={send}
      className="grid gap-2 rounded-xl border border-border bg-card py-2.5 pr-3 pl-4 transition-colors focus-within:border-ring/60"
    >
      <input
        aria-label="Ask Leonidas"
        value={prompt}
        onChange={(event) => setPrompt(event.target.value)}
        placeholder="Ask Leonidas to change something in your AIOS..."
        disabled={sending}
        className="h-8 bg-transparent text-sm outline-none placeholder:text-muted-foreground/70"
      />
      <div className="flex items-center gap-1.5">
        {root !== null ? (
          <Tip text="The chat can read and write this AIOS folder">
            <span
              tabIndex={0}
              className="inline-flex h-[26px] items-center gap-1.5 rounded-md border border-border/60 px-2 text-xs text-muted-foreground"
            >
              <FolderIcon aria-hidden className="size-3.5" />
              {workspace.active?.name ?? "Your AIOS"}
            </span>
          </Tip>
        ) : null}
        {error !== null ? (
          <span role="alert" className="truncate text-xs text-destructive-foreground">
            {error}
          </span>
        ) : null}
        <Tip text={ready ? "Start the chat (Enter)" : "Connect an AIOS folder to start a chat"}>
          <button
            type="submit"
            disabled={!ready || text === "" || sending}
            aria-label="Start the chat"
            className="ml-auto grid size-[30px] shrink-0 place-items-center rounded-full bg-primary text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-40"
          >
            {sending ? (
              <Spinner className="size-4" />
            ) : (
              <ArrowUpIcon aria-hidden className="size-4" />
            )}
          </button>
        </Tip>
      </div>
    </form>
  );
}
