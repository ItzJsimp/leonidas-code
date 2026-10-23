import { scopeThreadRef } from "@t3tools/client-runtime/environment";
import { useNavigate } from "@tanstack/react-router";
import { ArrowUpIcon, FolderIcon, RefreshCwIcon } from "lucide-react";
import { type FormEvent, useState } from "react";

import { Spinner } from "~/components/ui/spinner";
import { Tip } from "./Tip";
import { useActiveAiosWorkspace } from "~/components/workspace/useActiveAiosWorkspace";
import { useOnboardingChat } from "~/onboarding/useOnboardingChat";
import { buildThreadRouteParams } from "~/threadRoutes";

import { cn } from "~/lib/utils";

import { NumberTiles } from "../commandCenter/NumberTiles";
import { summaryItems, updatedLabel } from "../commandCenter/commandCenter.logic";
import { useNowMs, useUpdatedAt } from "../commandCenter/useHomeReads";
import { greetingFor } from "./copy";
import { useAiosHome, useTwoStateCounts } from "./useTwoStateData";

const TITLE_LENGTH = 60;

/** State 1: the greeting, one summary line, four number tiles and the Ask composer. */
export function CommandCenterForward() {
  const counts = useTwoStateCounts();
  const home = useAiosHome();
  const updatedAt = useUpdatedAt();
  const now = useNowMs();
  const date = new Date(now);
  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
        <div className="min-w-0">
          <h2 className="font-display text-3xl leading-tight font-bold tracking-tight">
            {greetingFor(date)}
          </h2>
          <p className="mt-1.5 text-sm text-muted-foreground">
            {date.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
            {" · "}
            {date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {summaryItems(counts).map((item, index) => (
              <span key={item.rest}>
                {index > 0 ? " · " : null}
                <span className="font-medium text-foreground">{item.lead}</span>
                {item.rest}
              </span>
            ))}
          </p>
        </div>
        <Tip text="Reads your AIOS folder again. This is when the newest data on this page was read.">
          <button
            type="button"
            onClick={home.refresh}
            className="inline-flex h-8 shrink-0 items-center gap-2 rounded-full border border-border bg-card px-3 text-xs text-muted-foreground transition-colors hover:bg-surface-raised hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
          >
            <RefreshCwIcon
              aria-hidden
              className={cn("size-3.5", home.isPending && "motion-safe:animate-spin")}
            />
            {updatedLabel(updatedAt, now)}
          </button>
        </Tip>
      </div>
      <NumberTiles />
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
