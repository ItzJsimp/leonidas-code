import { useState, useEffect } from "react";
import {
  MicIcon,
  RefreshCwIcon,
  ExternalLinkIcon,
  CopyIcon,
  CheckIcon,
  RadioIcon,
  PlusIcon,
  SendIcon,
  TerminalIcon,
  ChevronDownIcon,
  ChevronUpIcon,
} from "lucide-react";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Tooltip, TooltipPopup, TooltipTrigger } from "~/components/ui/tooltip";
import { Textarea } from "~/components/ui/textarea";
import {
  Dialog,
  DialogPopup,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "~/components/ui/dialog";
import {
  useScribeTeamFeed,
  SCRIBE_FEED_REPO,
  SCRIBE_FEED_ISSUE,
  buildGhBroadcastCommand,
  broadcastComment,
  type ScribeFeedItem,
} from "~/hooks/useScribeTeamFeed";

const ISSUE_URL = `https://github.com/${SCRIBE_FEED_REPO}/issues/${SCRIBE_FEED_ISSUE}`;

export function ScribeTeamFeedDialog({
  open,
  onOpenChange,
}: {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPopup className="h-[min(85dvh,46rem)] max-w-2xl">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <DialogTitle>Scribe Team Dictation Feed</DialogTitle>
            <Badge variant="outline" className="gap-1 bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-[10px]">
              <RadioIcon className="size-2.5 animate-pulse" />
              Live Sync (10s)
            </Badge>
          </div>
          <DialogDescription>
            Collaborative voice stream for Jake and Mob. Transcripts broadcasted by team members sync here automatically.
          </DialogDescription>
        </DialogHeader>

        {open && <FeedContents />}
      </DialogPopup>
    </Dialog>
  );
}

export function ScribeTeamFeedPanel() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 text-xs font-medium"
              onClick={() => setOpen(true)}
              aria-label="Scribe Team Feed"
            >
              <MicIcon className="size-3.5 text-primary" />
              <span>Team Feed</span>
            </Button>
          }
        />
        <TooltipPopup side="bottom">
          Scribe Collaborative Feed: Jake &amp; Mob stream
        </TooltipPopup>
      </Tooltip>

      <ScribeTeamFeedDialog open={open} onOpenChange={setOpen} />
    </>
  );
}

function FeedContents() {
  const { items, loading, error, refresh, lastRefreshedAt } = useScribeTeamFeed({
    pollIntervalMs: 10_000,
    enabled: true,
  });

  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showBroadcastForm, setShowBroadcastForm] = useState(false);

  // Form state
  const [author, setAuthor] = useState(() => {
    return typeof window !== "undefined"
      ? localStorage.getItem("leonidas_scribe_author") ?? "Jake"
      : "Jake";
  });
  const [text, setText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [copiedCli, setCopiedCli] = useState(false);
  const [broadcastFeedback, setBroadcastFeedback] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("leonidas_scribe_author", author);
    }
  }, [author]);

  const handleCopy = async (item: ScribeFeedItem) => {
    try {
      await navigator.clipboard.writeText(item.text);
      setCopiedId(item.id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      // Ignore clipboard error
    }
  };

  const handleCopyCliCommand = async () => {
    if (!text.trim()) return;
    const command = buildGhBroadcastCommand({ author, text: text.trim(), app: "Leonidas Code" });
    try {
      await navigator.clipboard.writeText(command);
      setCopiedCli(true);
      setTimeout(() => setCopiedCli(false), 2500);
      setBroadcastFeedback("Copied gh command! Paste into terminal to broadcast.");
    } catch {
      // Ignore
    }
  };

  const handleBroadcastSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;

    setIsSubmitting(true);
    setBroadcastFeedback(null);

    const token = typeof window !== "undefined" ? localStorage.getItem("leonidas_github_token") : null;

    if (!token) {
      // Prompt user or copy CLI command fallback
      handleCopyCliCommand();
      setBroadcastFeedback("Copied gh command to clipboard! (Set a GitHub PAT in settings or paste in terminal to publish)");
      setIsSubmitting(false);
      return;
    }

    const res = await broadcastComment({ author, text: text.trim(), app: "Leonidas Code" }, token);
    setIsSubmitting(false);

    if (res.ok) {
      setText("");
      setShowBroadcastForm(false);
      setBroadcastFeedback("Broadcast published!");
      refresh();
    } else {
      setBroadcastFeedback(res.error ?? "Failed to publish comment.");
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 px-6 pb-6">
      {/* Feed Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/50 pb-3">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            render={<a href={ISSUE_URL} target="_blank" rel="noreferrer" />}
            title="Open #scribe-feed issue thread on GitHub"
          >
            <ExternalLinkIcon className="size-3 mr-1" /> #{SCRIBE_FEED_ISSUE} on GitHub
          </Button>

          <Button
            variant={showBroadcastForm ? "secondary" : "default"}
            size="sm"
            className="h-7 text-xs gap-1"
            onClick={() => setShowBroadcastForm(!showBroadcastForm)}
          >
            <PlusIcon className="size-3" />
            <span>{showBroadcastForm ? "Hide Form" : "Add Broadcast"}</span>
            {showBroadcastForm ? <ChevronUpIcon className="size-3 ml-0.5" /> : <ChevronDownIcon className="size-3 ml-0.5" />}
          </Button>

          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="size-7"
                  onClick={() => refresh()}
                  disabled={loading}
                  aria-label="Refresh feed"
                >
                  <RefreshCwIcon className={`size-3.5 ${loading ? "animate-spin text-primary" : ""}`} />
                </Button>
              }
            />
            <TooltipPopup side="top">
              {lastRefreshedAt ? `Last checked ${new Date(lastRefreshedAt).toLocaleTimeString()}` : "Refresh feed"}
            </TooltipPopup>
          </Tooltip>
        </div>

        <span className="text-[11px] text-muted-foreground">
          {items.length} {items.length === 1 ? "transcript" : "transcripts"} &bull; $0 serverless
        </span>
      </div>

      {/* Quick Broadcast Form */}
      {showBroadcastForm ? (
        <form
          onSubmit={handleBroadcastSubmit}
          className="flex flex-col gap-2.5 rounded-lg border border-primary/30 bg-card/60 p-3 shadow-xs"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
              <SendIcon className="size-3 text-primary" />
              New Voice / Text Broadcast
            </span>

            {/* Author selector pills */}
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setAuthor("Jake")}
                className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold border transition-all ${
                  author === "Jake"
                    ? "bg-blue-500/20 text-blue-400 border-blue-500/50 shadow-xs"
                    : "bg-muted/40 text-muted-foreground border-border hover:bg-muted"
                }`}
              >
                &bull; Jake
              </button>
              <button
                type="button"
                onClick={() => setAuthor("Mob")}
                className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold border transition-all ${
                  author === "Mob"
                    ? "bg-purple-500/20 text-purple-400 border-purple-500/50 shadow-xs"
                    : "bg-muted/40 text-muted-foreground border-border hover:bg-muted"
                }`}
              >
                &bull; Mob
              </button>
            </div>
          </div>

          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={`Type a test transcript or dictation note from ${author}...`}
            className="text-xs min-h-16"
            size="sm"
          />

          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            <span className="text-[10.5px] text-muted-foreground font-mono">
              App: Leonidas Code
            </span>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 text-xs gap-1 text-muted-foreground hover:text-foreground"
                onClick={handleCopyCliCommand}
                disabled={!text.trim()}
                title="Copy ready-to-run gh command"
              >
                {copiedCli ? (
                  <>
                    <CheckIcon className="size-3 text-emerald-400" />
                    <span className="text-emerald-400">Copied</span>
                  </>
                ) : (
                  <>
                    <TerminalIcon className="size-3" />
                    <span>Copy gh Command</span>
                  </>
                )}
              </Button>

              <Button
                type="submit"
                size="sm"
                className="h-7 text-xs gap-1 font-semibold"
                disabled={!text.trim() || isSubmitting}
              >
                <SendIcon className="size-3" />
                <span>{isSubmitting ? "Broadcasting..." : "Broadcast"}</span>
              </Button>
            </div>
          </div>

          {broadcastFeedback ? (
            <p className="text-[11px] text-primary/90 mt-0.5 animate-fadeIn">
              {broadcastFeedback}
            </p>
          ) : null}
        </form>
      ) : null}

      {error ? (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
          Error loading team feed: {error}
        </div>
      ) : null}

      {/* Transcript Items */}
      <div className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto pr-1">
        {items.length === 0 && !loading ? (
          <div className="flex flex-1 flex-col items-center justify-center py-12 text-center text-muted-foreground">
            <MicIcon className="size-8 opacity-40 mb-2" />
            <p className="text-sm font-medium">No shared transcripts yet</p>
            <p className="text-xs">Broadcast dictations from Scribe to share them with the team.</p>
          </div>
        ) : (
          items.map((item) => {
            const isMob = item.author.toLowerCase().includes("mob");
            const isJake = item.author.toLowerCase().includes("jake") || item.author.toLowerCase().includes("itzjsimp");

            return (
              <div
                key={item.id}
                className="group relative flex flex-col gap-1.5 rounded-lg border border-border/60 bg-card/40 p-3 transition-colors hover:bg-card/70"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold border ${
                        isMob
                          ? "bg-purple-500/15 text-purple-400 border-purple-500/30"
                          : isJake
                            ? "bg-blue-500/15 text-blue-400 border-blue-500/30"
                            : "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                      }`}
                    >
                      &bull; {item.author}
                    </span>
                    {item.app ? (
                      <span className="text-[10px] text-muted-foreground/75 font-mono">
                        {item.app}
                      </span>
                    ) : null}
                  </div>

                  <span className="text-[11px] text-muted-foreground">
                    {new Date(item.createdAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                  </span>
                </div>

                <p className="text-xs text-foreground/90 leading-relaxed font-normal select-text">
                  &ldquo;{item.text}&rdquo;
                </p>

                <div className="flex items-center justify-between pt-1 border-t border-border/30 text-[10px] text-muted-foreground">
                  <div className="flex items-center gap-2">
                    {item.latencyMs ? <span>Latency: {item.latencyMs}ms</span> : null}
                  </div>

                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 gap-1 px-2 text-[10.5px] opacity-80 group-hover:opacity-100"
                    onClick={() => handleCopy(item)}
                  >
                    {copiedId === item.id ? (
                      <>
                        <CheckIcon className="size-3 text-emerald-400" />
                        <span className="text-emerald-400">Copied</span>
                      </>
                    ) : (
                      <>
                        <CopyIcon className="size-3" />
                        <span>Copy</span>
                      </>
                    )}
                  </Button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
