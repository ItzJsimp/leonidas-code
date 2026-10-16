import {
  isAtomCommandInterrupted,
  squashAtomCommandFailure,
} from "@t3tools/client-runtime/state/runtime";
import type { EnvironmentId, FocusUpdateInput, ProjectId } from "@t3tools/contracts";
import { FOCUS_ITEM_MAX_LENGTH } from "@t3tools/contracts";
import { GripVerticalIcon, HouseIcon, ListPlusIcon, Trash2Icon, XIcon } from "lucide-react";
import {
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
  type PointerEvent,
  type ReactElement,
  type ReactNode,
} from "react";

import { useEnvironmentQuery } from "~/state/query";
import { focusLive, focusUpdate, taskBoardCardCreate } from "~/state/taskBoard";
import { useAtomCommand } from "~/state/use-atom-command";
import { failureText } from "../taskBoard/useTaskActions.logic";
import { Button } from "../ui/button";
import { Checkbox } from "../ui/checkbox";
import { Input } from "../ui/input";
import { Spinner } from "../ui/spinner";
import { Toggle, ToggleGroup } from "../ui/toggle-group";
import { Tooltip, TooltipPopup, TooltipTrigger } from "../ui/tooltip";
import {
  clampToViewport,
  nudge,
  progressOf,
  settleDrag,
  visibleRows,
  type FocusRow,
  type Point,
} from "./focusWidget.logic";
import { useFocusWidgetStore } from "./focusWidgetStore";

function Tip(props: { label: string; children: ReactElement }) {
  return (
    <Tooltip>
      <TooltipTrigger render={props.children} />
      <TooltipPopup side="top">{props.label}</TooltipPopup>
    </Tooltip>
  );
}

const viewportSize = () => ({ width: window.innerWidth, height: window.innerHeight });

/**
 * Floating notepad of what the user has on their mind, read from `<AIOS>/memory/focus.md`.
 * Docked at the top right of its parent; drag the header to float it anywhere in the window.
 */
export default function FocusWidget(props: {
  environmentId: EnvironmentId;
  projectId: ProjectId | null;
}) {
  const { position, scope, setPosition, setScope, setVisible } = useFocusWidgetStore();
  const query = useEnvironmentQuery(focusLive({ environmentId: props.environmentId, input: {} }));
  const runUpdate = useAtomCommand(focusUpdate, { reportFailure: false });
  const runCreate = useAtomCommand(taskBoardCardCreate, { reportFailure: false });
  const rootRef = useRef<HTMLElement | null>(null);
  const dockRef = useRef<HTMLDivElement | null>(null);
  const drag = useRef<{ pointerId: number; offset: Point } | null>(null);
  const [dragPoint, setDragPoint] = useState<Point | null>(null);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState("");

  const snapshot = query.data;
  const rows = visibleRows(snapshot, scope, props.projectId);
  const { done, total } = progressOf(rows);

  // A window resize can leave a floating widget off screen; pull it back once per resize.
  useLayoutEffect(() => {
    if (position === null) return;
    const onResize = () => {
      const node = rootRef.current;
      if (!node) return;
      const next = clampToViewport(position, node.getBoundingClientRect(), viewportSize());
      if (next.x !== position.x || next.y !== position.y) setPosition(next);
    };
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [position, setPosition]);

  const update = useCallback(
    async (input: FocusUpdateInput, failure: string) => {
      setError(null);
      const result = await runUpdate({ environmentId: props.environmentId, input });
      if (result._tag === "Success" || isAtomCommandInterrupted(result)) return true;
      setError(failureText(squashAtomCommandFailure(result), failure));
      return false;
    },
    [props.environmentId, runUpdate],
  );

  const add = async (event: FormEvent) => {
    event.preventDefault();
    const text = draft.trim();
    if (!text || busy) return;
    setBusy(true);
    const ok = await update(
      { op: "add", projectId: scope === "project" ? props.projectId : null, text },
      "Could not add the focus. Try again.",
    );
    setBusy(false);
    if (ok) {
      setDraft("");
      setNotice(`Added ${text}`);
    }
  };

  const promote = async (row: FocusRow) => {
    if (!snapshot) return;
    setError(null);
    const result = await runCreate({
      environmentId: props.environmentId,
      input: {
        title: row.text.slice(0, 256),
        projectSlug: row.slug,
        actor: snapshot.member,
        ...(row.text.length > 256 ? { description: row.text } : {}),
      },
    });
    if (result._tag === "Success") {
      await update({ op: "remove", id: row.id }, "The card was made, but the line stays.");
      setNotice(`Made a task card: ${row.text}`);
    } else if (!isAtomCommandInterrupted(result)) {
      setError(failureText(squashAtomCommandFailure(result), "Could not make a task card."));
    }
  };

  const dockPoint = (): Point | null => {
    const dock = dockRef.current?.getBoundingClientRect();
    return dock ? { x: dock.left, y: dock.top } : null;
  };

  const onPointerDown = (event: PointerEvent<HTMLElement>) => {
    if (event.button !== 0 || (event.target as HTMLElement).closest("button")) return;
    const box = rootRef.current?.getBoundingClientRect();
    if (!box) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = {
      pointerId: event.pointerId,
      offset: { x: event.clientX - box.left, y: event.clientY - box.top },
    };
    setDragPoint({ x: box.left, y: box.top });
  };
  const onPointerMove = (event: PointerEvent<HTMLElement>) => {
    const active = drag.current;
    const box = rootRef.current?.getBoundingClientRect();
    if (!active || active.pointerId !== event.pointerId || !box) return;
    setDragPoint(
      clampToViewport(
        { x: event.clientX - active.offset.x, y: event.clientY - active.offset.y },
        box,
        viewportSize(),
      ),
    );
  };
  const onPointerUp = (event: PointerEvent<HTMLElement>) => {
    const active = drag.current;
    if (!active || active.pointerId !== event.pointerId) return;
    drag.current = null;
    const box = rootRef.current?.getBoundingClientRect();
    if (dragPoint && box) setPosition(settleDrag(dragPoint, dockPoint(), box, viewportSize()));
    setDragPoint(null);
  };
  const onHandleKey = (event: KeyboardEvent<HTMLElement>) => {
    const box = rootRef.current?.getBoundingClientRect();
    if (!box) return;
    if (event.key === "Home" || event.key === "Escape") {
      event.preventDefault();
      setPosition(null);
      return;
    }
    const next = nudge(position ?? { x: box.left, y: box.top }, event.key, event.shiftKey);
    if (!next) return;
    event.preventDefault();
    setPosition(clampToViewport(next, box, viewportSize()));
  };

  const floating = dragPoint ?? position;
  let body: ReactNode;
  if (query.isPending && !snapshot) {
    body = (
      <p role="status" className="flex items-center gap-2 px-3 py-3 text-muted-foreground text-xs">
        <Spinner /> Loading your notepad
      </p>
    );
  } else if (!snapshot && query.error) {
    body = (
      <div role="alert" className="flex flex-col gap-2 px-3 py-3 text-xs">
        <p className="text-destructive">Could not read the notepad. {query.error}</p>
        <Button size="xs" variant="outline" onClick={query.refresh}>
          Try again
        </Button>
      </div>
    );
  } else if (rows.length === 0) {
    body = (
      <p className="px-3 py-3 text-muted-foreground text-xs">
        {snapshot?.path === null
          ? "No AIOS folder is connected, so there is no place to keep a notepad."
          : "Nothing here yet. Add a note below. It saves to memory/focus.md."}
      </p>
    );
  } else {
    body = (
      <ul className="flex max-h-72 flex-col overflow-y-auto py-1" aria-label="Focus items">
        {rows.map((row) => (
          <li
            key={row.id}
            className="group flex items-start gap-2 px-3 py-1 hover:bg-accent/50 focus-within:bg-accent/50"
          >
            <Checkbox
              className="mt-0.5"
              checked={row.done}
              aria-label={row.done ? `Clear tick: ${row.text}` : `Tick: ${row.text}`}
              onCheckedChange={(checked) =>
                void update(
                  { op: "set_done", id: row.id, done: checked === true },
                  "Could not change the item. Try again.",
                )
              }
            />
            <span
              className={`min-w-0 flex-1 break-words text-xs leading-5 ${row.done ? "text-muted-foreground line-through" : ""}`}
            >
              {scope === "all" && row.slug !== null ? (
                <span className="mr-1 text-muted-foreground">{row.slug}:</span>
              ) : null}
              <span className="line-clamp-3 group-hover:line-clamp-none group-focus-within:line-clamp-none">
                {row.text}
              </span>
            </span>
            <span className="flex shrink-0 gap-0.5 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100">
              <Tip label="Make a task card from this line">
                <Button
                  size="icon-xs"
                  variant="ghost-muted"
                  aria-label={`Make a task card: ${row.text}`}
                  onClick={() => void promote(row)}
                >
                  <ListPlusIcon />
                </Button>
              </Tip>
              <Tip label="Remove this line">
                <Button
                  size="icon-xs"
                  variant="ghost-muted"
                  aria-label={`Remove: ${row.text}`}
                  onClick={() =>
                    void update({ op: "remove", id: row.id }, "Could not remove the item.")
                  }
                >
                  <Trash2Icon />
                </Button>
              </Tip>
            </span>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <>
      {/* The dock marks where the docked widget sits, so a drop near it can snap home. */}
      <div
        ref={dockRef}
        aria-hidden
        className="pointer-events-none absolute top-2 right-2 size-0"
      />
      <section
        ref={rootRef}
        aria-label="Notepad"
        className={`z-30 flex w-72 flex-col overflow-hidden rounded-lg border border-border bg-popover text-popover-foreground shadow-lg ${floating ? "fixed" : "absolute top-2 right-2"}`}
        style={floating ? { left: floating.x, top: floating.y } : undefined}
      >
        <header
          className="flex cursor-grab touch-none items-center gap-1 border-b border-border py-1 pr-1 pl-1.5 select-none active:cursor-grabbing"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onDoubleClick={() => setPosition(null)}
        >
          <Tip label="Drag to move. Arrow keys move it. Home or Escape docks it.">
            <span
              role="button"
              tabIndex={0}
              aria-label="Move the notepad"
              className="flex items-center rounded text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
              onKeyDown={onHandleKey}
            >
              <GripVerticalIcon className="size-3.5" />
            </span>
          </Tip>
          <span className="flex-1 truncate font-medium text-2xs uppercase tracking-wide text-muted-foreground">
            Notepad {total > 0 ? `${done}/${total}` : ""}
          </span>
          <ToggleGroup
            aria-label="Which focus items to show"
            value={[scope]}
            onValueChange={(value) => {
              const next = value[0];
              if (next === "project" || next === "all") setScope(next);
            }}
          >
            <Tip label="This project and Global">
              <Toggle value="project" aria-label="Show this project">
                Project
              </Toggle>
            </Tip>
            <Tip label="Every project">
              <Toggle value="all" aria-label="Show all projects">
                All
              </Toggle>
            </Tip>
          </ToggleGroup>
          <Tip label="Dock at the top right">
            <Button
              size="icon-xs"
              variant="ghost-muted"
              aria-label="Dock the notepad"
              disabled={position === null}
              onClick={() => setPosition(null)}
            >
              <HouseIcon />
            </Button>
          </Tip>
          <Tip label="Hide the notepad">
            <Button
              size="icon-xs"
              variant="ghost-muted"
              aria-label="Hide the notepad"
              onClick={() => setVisible(false)}
            >
              <XIcon />
            </Button>
          </Tip>
        </header>
        <div
          className="h-0.5 bg-muted"
          role="progressbar"
          aria-label="Focus progress"
          aria-valuemin={0}
          aria-valuemax={total}
          aria-valuenow={done}
        >
          <div
            className="h-full bg-primary transition-[width] duration-300 motion-reduce:transition-none"
            style={{ width: total === 0 ? 0 : `${(done / total) * 100}%` }}
          />
        </div>
        {body}
        {error ? (
          <p role="alert" className="px-3 pb-1 text-destructive text-xs">
            {error}
          </p>
        ) : null}
        <form onSubmit={(event) => void add(event)} className="border-t border-border p-2">
          <Input
            size="sm"
            aria-label="Add a note"
            placeholder="+ Add a note"
            maxLength={FOCUS_ITEM_MAX_LENGTH}
            value={draft}
            disabled={busy || snapshot?.path === null}
            onChange={(event) => setDraft(event.target.value)}
          />
        </form>
        <span role="status" className="sr-only">
          {notice}
        </span>
      </section>
    </>
  );
}
