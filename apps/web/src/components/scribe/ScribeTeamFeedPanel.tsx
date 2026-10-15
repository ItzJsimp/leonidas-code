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
            <DialogTitle>Team dictations</DialogTitle>
            <Badge
              variant="outline"
              className="gap-1 bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-[10px]"
            >
              <RadioIcon className="size-2.5 animate-pulse" />
              Updates every 10 seconds
            </Badge>
          </div>
          <DialogDescription>
            Dictations that your team shares appear here by themselves.
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
              aria-label="Team dictations"
            >
              <MicIcon className="size-3.5 text-primary" />
              <span>Team dictations</span>
            </Button>
          }
        />
        <TooltipPopup side="bottom">Dictations that your team shares</TooltipPopup>
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
      ? (localStorage.getItem("leonidas_scribe_author") ?? "")
      : "";
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
    const command = buildGhBroadcastCommand({
      author: author.trim() || "Me",
      text: text.trim(),
      app: "Leonidas Code",
    });
    try {
      await navigator.clipboard.writeText(command);
      setCopiedCli(true);
      setTimeout(() => setCopiedCli(false), 2500);
      setBroadcastFeedback("Copied the command. Paste it in a terminal to share your dictation.");
    } catch {
      // Ignore
    }
  };

  const handleBroadcastSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;

    setIsSubmitting(true);
    setBroadcastFeedback(null);

    const token =
      typeof window !== "undefined" ? localStorage.getItem("leonidas_github_token") : null;

    if (!token) {
      // Prompt user or copy CLI command fallback
      handleCopyCliCommand();
      setBroadcastFeedback(
        "Copied the command. To share from here, add a GitHub token in settings. Or paste the command in a terminal.",
      );
      setIsSubmitting(false);
      return;
    }

    const res = await broadcastComment(
      { author: author.trim() || "Me", text: text.trim(), app: "Leonidas Code" },
      token,
    );
    setIsSubmitting(false);

    if (res.ok) {
      setText("");
      setShowBroadcastForm(false);
      setBroadcastFeedback("Dictation shared.");
      refresh();
    } else {
      setBroadcastFeedback(res.error ?? "Could not share the dictation. Try again.");
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
            title="Open the team dictations page on GitHub"
          >
            <ExternalLinkIcon className="size-3 mr-1" /> Open on GitHub (#{SCRIBE_FEED_ISSUE})
          </Button>

          <Button
            variant={showBroadcastForm ? "secondary" : "default"}
            size="sm"
            className="h-7 text-xs gap-1"
            onClick={() => setShowBroadcastForm(!showBroadcastForm)}
          >
            <PlusIcon className="size-3" />
            <span>{showBroadcastForm ? "Hide form" : "Share a dictation"}</span>
            {showBroadcastForm ? (
              <ChevronUpIcon className="size-3 ml-0.5" />
            ) : (
              <ChevronDownIcon className="size-3 ml-0.5" />
            )}
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
                  aria-label="Refresh list"
                >
                  <RefreshCwIcon
                    className={`size-3.5 ${loading ? "animate-spin text-primary" : ""}`}
                  />
                </Button>
              }
            />
            <TooltipPopup side="top">
              {lastRefreshedAt
                ? `Last checked ${new Date(lastRefreshedAt).toLocaleTimeString()}`
                : "Refresh list"}
            </TooltipPopup>
          </Tooltip>
        </div>

        <span className="text-[11px] text-muted-foreground">
          {items.length} {items.length === 1 ? "dictation" : "dictations"}
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
              Share a dictation
            </span>

            <input
              value={author}
              onChange={(e) => setAuthor(e.target.value)}
              placeholder="Your name"
              aria-label="Your name"
              className="w-28 rounded-md border border-border bg-muted/40 px-2 py-0.5 text-[11px]"
            />
          </div>

          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={`Type a dictation to share, from ${author || "you"}…`}
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
                title="Copy a command that shares this dictation on GitHub"
              >
                {copiedCli ? (
                  <>
                    <CheckIcon className="size-3 text-emerald-400" />
                    <span className="text-emerald-400">Copied</span>
                  </>
                ) : (
                  <>
                    <TerminalIcon className="size-3" />
                    <span>Copy command</span>
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
                <span>{isSubmitting ? "Sharing…" : "Share"}</span>
              </Button>
            </div>
          </div>

          {broadcastFeedback ? (
            <p className="text-[11px] text-primary/90 mt-0.5 animate-fadeIn">{broadcastFeedback}</p>
          ) : null}
        </form>
      ) : null}

      {error ? (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
          Could not load the team dictations: {error}. Select Refresh to try again.
        </div>
      ) : null}

      {/* Transcript Items */}
      <div className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto pr-1">
        {items.length === 0 && !loading ? (
          <div className="flex flex-1 flex-col items-center justify-center py-12 text-center text-muted-foreground">
            <MicIcon className="size-8 opacity-40 mb-2" />
            <p className="text-sm font-medium">No shared dictations yet</p>
            <p className="text-xs">Share a dictation from Scribe. Your team will see it here.</p>
          </div>
        ) : (
          items.map((item) => {
            return (
              <div
                key={item.id}
                className="group relative flex flex-col gap-1.5 rounded-lg border border-border/60 bg-card/40 p-3 transition-colors hover:bg-card/70"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold border bg-emerald-500/15 text-emerald-400 border-emerald-500/30">
                      &bull; {item.author}
                    </span>
                    {item.app ? (
                      <span className="text-[10px] text-muted-foreground/75 font-mono">
                        {item.app}
                      </span>
                    ) : null}
                  </div>

                  <span className="text-[11px] text-muted-foreground">
                    {new Date(item.createdAt).toLocaleTimeString([], {
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </span>
                </div>

                <p className="text-xs text-foreground/90 leading-relaxed font-normal select-text">
                  &ldquo;{item.text}&rdquo;
                </p>

                <div className="flex items-center justify-between pt-1 border-t border-border/30 text-[10px] text-muted-foreground">
                  <div className="flex items-center gap-2">
                    {item.latencyMs ? <span>Took {item.latencyMs}ms</span> : null}
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
