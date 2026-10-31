import { ChevronRightIcon } from "lucide-react";
import { useMemo, type ComponentProps } from "react";
import { parseOutputDock, type DockSection, type DockStatus } from "@t3tools/shared/outputDock";
import ChatMarkdown from "../ChatMarkdown";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Collapsible, CollapsiblePanel, CollapsibleTrigger } from "../ui/collapsible";

/** Actions prepare a draft; the composer remains the only place that sends it. */
/** Fixed reply for the "Explain simpler" button. */
export const EXPLAIN_SIMPLER_REPLY =
  "Explain your last answer again in simpler words. Define each technical term.";

export function OutputDock({
  sections,
  onReply,
  simple = false,
  renderMarkdown,
}: {
  sections: DockSection[];
  onReply?: ((text: string) => void) | undefined;
  /** Below the builder level: hide Next Actions and show the Explain simpler button. */
  simple?: boolean | undefined;
  renderMarkdown: (text: string) => React.ReactNode;
}) {
  const shown = simple ? sections.filter((section) => section.kind !== "actions") : sections;
  return (
    <div data-output-dock className="mt-4 space-y-4 rounded-xl border border-border bg-card/50 p-4">
      {shown.map((section) => (
        <section key={section.kind} aria-label={section.heading}>
          <h3 className="mb-2 text-sm font-semibold text-foreground">{section.heading}</h3>
          <div className="space-y-2">
            {section.items.map((item, index) => {
              const key = `${item.kind}:${index}:${item.kind === "replies" ? item.replies.join("|") : item.text}`;
              if (item.kind === "markdown") return <div key={key}>{renderMarkdown(item.text)}</div>;
              if (item.kind === "replies")
                return (
                  <div key={key} className="flex flex-wrap gap-2">
                    {item.replies.map((reply, i) => (
                      <Button
                        key={`${reply}:${i}`}
                        type="button"
                        variant="outline"
                        disabled={!onReply}
                        onClick={() => onReply?.(reply)}
                      >
                        {reply}
                      </Button>
                    ))}
                  </div>
                );
              if (item.kind === "option")
                return (
                  <div key={key} className="rounded-lg border border-border p-3">
                    {renderMarkdown(item.text)}
                    <div className="mt-2">
                      <Button
                        type="button"
                        variant="outline"
                        disabled={!onReply}
                        onClick={() => onReply?.(item.reply)}
                      >
                        Choose {item.letter}
                      </Button>
                    </div>
                  </div>
                );
              return (
                <div key={key} className="flex flex-wrap items-center gap-3">
                  <div className="min-w-0 flex-1">{renderMarkdown(item.text)}</div>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={!onReply}
                    onClick={() => onReply?.(item.reply)}
                  >
                    Start
                  </Button>
                </div>
              );
            })}
          </div>
        </section>
      ))}
      {simple && onReply ? (
        <Button
          type="button"
          size="xs"
          variant="outline"
          onClick={() => onReply(EXPLAIN_SIMPLER_REPLY)}
        >
          Explain simpler
        </Button>
      ) : null}
      {onReply ? (
        <p className="text-xs text-muted-foreground">
          Buttons fill your message box. Check it, then send.
        </p>
      ) : null}
    </div>
  );
}

const STATUS = {
  done: { label: "Done", variant: "success" },
  "need-you": { label: "Need you", variant: "warning" },
  blocked: { label: "Blocked", variant: "error" },
} as const;
const ATTENTION = { none: "No thought needed", glance: "Quick look", think: "Needs thought" };

/** Status pills above the reply, and the body folded under Details past 3 lines. */
export function ReplyBody({
  status,
  body,
  renderMarkdown,
}: {
  status?: DockStatus | undefined;
  body: string;
  renderMarkdown: (text: string) => React.ReactNode;
}) {
  const lines = body.split("\n").filter((line) => line.trim()).length;
  return (
    <>
      {status ? (
        <div data-status-bar className="mb-3 flex flex-wrap items-center gap-2">
          <Badge variant={STATUS[status.state].variant}>{STATUS[status.state].label}</Badge>
          <Badge variant="outline">{ATTENTION[status.attention]}</Badge>
          {status.place ? (
            <span className="min-w-0 truncate text-xs text-muted-foreground">{status.place}</span>
          ) : null}
        </div>
      ) : null}
      {lines > 3 ? (
        <Collapsible>
          <CollapsibleTrigger className="group/details flex min-h-8 items-center gap-1.5 rounded-md px-1 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring">
            <ChevronRightIcon
              aria-hidden
              className="size-3.5 shrink-0 transition-transform duration-200 group-data-panel-open/details:rotate-90"
            />
            Details
          </CollapsibleTrigger>
          <CollapsiblePanel>{renderMarkdown(body)}</CollapsiblePanel>
        </Collapsible>
      ) : lines > 0 ? (
        renderMarkdown(body)
      ) : null}
    </>
  );
}

export function AssistantOutput({
  onReply,
  simple,
  ...props
}: ComponentProps<typeof ChatMarkdown> & {
  onReply?: ((text: string) => void) | undefined;
  simple?: boolean | undefined;
}) {
  const dock = useMemo(
    () => (props.isStreaming ? null : parseOutputDock(props.text)),
    [props.text, props.isStreaming],
  );
  if (!dock) return <ChatMarkdown {...props} />;
  return (
    <>
      <ReplyBody
        status={dock.status}
        body={dock.body}
        renderMarkdown={(text) => <ChatMarkdown {...props} text={text} />}
      />
      <OutputDock
        sections={dock.sections}
        onReply={onReply}
        simple={simple}
        renderMarkdown={(text) => <ChatMarkdown {...props} text={text} />}
      />
    </>
  );
}
