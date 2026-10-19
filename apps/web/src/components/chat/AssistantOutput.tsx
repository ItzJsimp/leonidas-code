import { useMemo, type ComponentProps } from "react";
import { parseOutputDock, type DockSection } from "@t3tools/shared/outputDock";
import ChatMarkdown from "../ChatMarkdown";
import { Button } from "../ui/button";
import { Checkbox } from "../ui/checkbox";

/** Actions prepare a draft; the composer remains the only place that sends it. */
export function OutputDock({
  sections,
  onReply,
  renderMarkdown,
}: {
  sections: DockSection[];
  onReply?: ((text: string) => void) | undefined;
  renderMarkdown: (text: string) => React.ReactNode;
}) {
  return (
    <div data-output-dock className="mt-4 space-y-4 rounded-xl border border-border bg-card/50 p-4">
      {sections.map((section) => (
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
      {onReply ? (
        <p className="text-xs text-muted-foreground">
          Actions and replies fill your composer. Review before sending.
        </p>
      ) : null}
    </div>
  );
}

export function AssistantOutput({
  onReply,
  ...props
}: ComponentProps<typeof ChatMarkdown> & {
  onReply?: ((text: string) => void) | undefined;
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
        renderMarkdown={(text) => <ChatMarkdown {...props} text={text} />}
      />
    </>
  );
}
