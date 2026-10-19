import { useMemo, type ComponentProps } from "react";
import { parseOutputDock, type DockSection } from "@t3tools/shared/outputDock";
import ChatMarkdown from "../ChatMarkdown";
import { Button } from "../ui/button";
import { Checkbox } from "../ui/checkbox";

/** Actions prepare a draft; the composer remains the only place that sends it. */
/** Fixed reply for the "Explain simpler" button. */
export const EXPLAIN_SIMPLER_REPLY =
  "Explain your last answer again in simpler words. Define each technical term.";

export function OutputDock({
  sections,
  onReply,
  onUndo,
  simple = false,
  renderMarkdown,
}: {
  sections: DockSection[];
  onReply?: ((text: string) => void) | undefined;
  /** Reverts the files and chat to before this turn; absent when the turn has no checkpoint. */
  onUndo?: (() => void) | undefined;
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
              const key = `${item.kind}:${index}:${item.kind === "replies" ? item.replies.join("|") : item.kind === "assumptions" ? item.choices.join("|") : item.text}`;
              if (item.kind === "assumptions")
                return (
                  <div key={key} className="flex flex-wrap items-center gap-2">
                    <span className="text-xs text-muted-foreground">I chose:</span>
                    {item.choices.map((choice, i) => (
                      <Button
                        key={`${choice}:${i}`}
                        type="button"
                        size="xs"
                        variant="outline"
                        disabled={!onReply}
                        aria-label={`Change this choice: ${choice}`}
                        title="Tap to change this choice"
                        onClick={() => onReply?.(`Change this: "${choice}". Use this instead: `)}
                      >
                        {choice}
                      </Button>
                    ))}
                  </div>
                );
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
                <div key={key} className="flex items-start gap-3 rounded-lg bg-muted/30 p-3">
                  <div className="flex min-h-6 items-center">
                    <Checkbox
                      size="touch"
                      checked={item.checked}
                      disabled={item.checked || !onReply}
                      aria-label={`Add action to composer: ${item.text.replaceAll("**", "")}`}
                      onCheckedChange={() =>
                        onReply?.(item.text.replace(/^(?:🤖|👤) \*\*[^*]+:\*\*\s*/, ""))
                      }
                    />
                  </div>
                  <div className="min-w-0 flex-1">{renderMarkdown(item.text)}</div>
                </div>
              );
            })}
          </div>
        </section>
      ))}
      {onUndo || (simple && onReply) ? (
        <div className="flex flex-wrap gap-2">
          {onUndo ? (
            <Button
              type="button"
              size="xs"
              variant="outline"
              onClick={onUndo}
              title="Your files and this chat go back to before this turn"
            >
              Undo this turn
            </Button>
          ) : null}
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
        </div>
      ) : null}
      {onReply ? (
        <p className="text-xs text-muted-foreground">
          Buttons fill your message box. Check it, then send.
        </p>
      ) : null}
    </div>
  );
}

export function AssistantOutput({
  onReply,
  onUndo,
  simple,
  ...props
}: ComponentProps<typeof ChatMarkdown> & {
  onReply?: ((text: string) => void) | undefined;
  onUndo?: (() => void) | undefined;
  simple?: boolean | undefined;
}) {
  const dock = useMemo(
    () => (props.isStreaming ? null : parseOutputDock(props.text)),
    [props.text, props.isStreaming],
  );
  if (!dock) return <ChatMarkdown {...props} />;
  return (
    <>
      <ChatMarkdown {...props} text={dock.body} />
      <OutputDock
        sections={dock.sections}
        onReply={onReply}
        onUndo={onUndo}
        simple={simple}
        renderMarkdown={(text) => <ChatMarkdown {...props} text={text} />}
      />
    </>
  );
}
