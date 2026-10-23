import { scopeThreadRef } from "@t3tools/client-runtime/environment";
import type { EnvironmentId, ThreadId } from "@t3tools/contracts";
import { useLocation, useNavigate } from "@tanstack/react-router";
import { MessageSquareIcon, PanelLeftCloseIcon, PanelLeftOpenIcon } from "lucide-react";
import {
  lazy,
  Suspense,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import ThreadSidebar from "~/components/Sidebar";
import { ThreadRouteView } from "~/components/ThreadRouteView";
import { Button } from "~/components/ui/button";
import { Sidebar } from "~/components/ui/sidebar";
import { useHandleNewThread } from "~/hooks/useHandleNewThread";
import { startNewThreadFromContext } from "~/lib/chatThreadActions";
import { cn } from "~/lib/utils";
import { observeResize } from "~/lib/observeResize";
import { useThreadShell } from "~/state/entities";
import type { ThreadRouteTarget } from "~/threadRoutes";

import { Tip } from "./Tip";
import { useTwoStateStore } from "./twoStateStore";

const GuidanceCoach = lazy(() =>
  import("~/components/onboarding/GuidanceCoach").then((module) => ({
    default: module.GuidanceCoach,
  })),
);

/** Below this pane width the chat list floats over the chat instead of sitting beside it. */
const LIST_BESIDE_MIN_WIDTH = 720;

/**
 * The right pane: a chat list column you can hide, and the chat. The chat is the URL's chat, else
 * the last chat, else a plain empty state.
 */
export function ChatPane({
  urlTarget,
  reserveTop = false,
}: {
  /** The chat or draft in the URL, or null on a rail window page. */
  readonly urlTarget: ThreadRouteTarget | null;
  /** Leave room under the pinned menu button when the rail is a drawer. */
  readonly reserveTop?: boolean;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const chatListOpen = useTwoStateStore((state) => state.chatListOpen);
  const setChatListOpen = useTwoStateStore((state) => state.setChatListOpen);
  const lastThread = useTwoStateStore((state) => state.lastThread);
  const [floatingOpen, setFloatingOpen] = useState(false);
  const pathname = useLocation({ select: (location) => location.pathname });
  const listId = useId();

  useLayoutEffect(() => {
    const element = rootRef.current;
    if (!element) return;
    return observeResize(element, ([entry]) => {
      if (entry) setWidth(entry.contentRect.width);
    });
  }, []);
  // Choosing a chat opens another page: a floating list has done its job.
  useEffect(() => setFloatingOpen(false), [pathname]);

  const lastRef = useMemo(
    () =>
      lastThread
        ? scopeThreadRef(lastThread.environmentId as EnvironmentId, lastThread.threadId as ThreadId)
        : null,
    [lastThread],
  );
  // A remembered chat that was deleted must not render: its view would redirect the page.
  const lastShell = useThreadShell(urlTarget ? null : lastRef);
  const target: ThreadRouteTarget | null =
    urlTarget ??
    (lastRef && lastShell && lastShell.deletedAt == null
      ? { kind: "server", threadRef: lastRef }
      : null);

  const beside = width >= LIST_BESIDE_MIN_WIDTH;
  const open = beside ? chatListOpen : floatingOpen;
  const toggle = () => (beside ? setChatListOpen(!chatListOpen) : setFloatingOpen(!floatingOpen));
  const ToggleIcon = open ? PanelLeftCloseIcon : PanelLeftOpenIcon;
  const label = open ? "Hide the chat list" : "Show the chat list";

  return (
    <div
      ref={rootRef}
      aria-label="Chat"
      role="region"
      className="relative flex h-full min-h-0 min-w-0 flex-1 bg-background"
    >
      <div
        className={cn(
          "flex w-8 shrink-0 flex-col items-center border-r border-border pt-2",
          reserveTop && "pt-[calc(var(--workspace-topbar-height)+0.5rem)]",
        )}
      >
        <Tip text={label}>
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label={label}
            aria-expanded={open}
            aria-controls={listId}
            onClick={toggle}
          >
            <ToggleIcon />
          </Button>
        </Tip>
      </div>
      {open ? (
        <Sidebar
          collapsible="none"
          id={listId}
          role="navigation"
          aria-label="Chats"
          className={cn(
            "w-72 shrink-0 border-r border-border",
            !beside && "absolute inset-y-0 left-8 z-30",
          )}
        >
          <ThreadSidebar />
          <Suspense fallback={null}>
            <GuidanceCoach />
          </Suspense>
        </Sidebar>
      ) : null}
      <div className="flex min-h-0 min-w-0 flex-1 [&>main]:h-full">
        {target ? <ThreadRouteView target={target} /> : <EmptyChat />}
      </div>
    </div>
  );
}

/** No chat is open and none is remembered. */
function EmptyChat() {
  const navigate = useNavigate();
  const { activeDraftThread, activeThread, defaultProjectRef, handleNewThread } =
    useHandleNewThread();
  const start = async () => {
    const started = await startNewThreadFromContext({
      activeDraftThread,
      activeThread: activeThread ?? undefined,
      defaultProjectRef,
      handleNewThread,
    });
    // Without a project the chat start page explains how to begin.
    if (!started) void navigate({ to: "/" });
  };
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
      <MessageSquareIcon aria-hidden className="size-6 text-muted-foreground" />
      <p className="max-w-xs text-sm text-muted-foreground">
        No chat is open. Start one to talk with Leonidas.
      </p>
      <Button onClick={() => void start()}>Start a chat</Button>
    </div>
  );
}
