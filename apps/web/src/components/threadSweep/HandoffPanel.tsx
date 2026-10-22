import { useCopyToClipboard } from "../../hooks/useCopyToClipboard";
import { Button } from "../ui/button";
import { Spinner } from "../ui/spinner";
import { Textarea } from "../ui/textarea";
import type { HandoffState } from "./threadSweep.logic";

/** The handoff prompt for one chat: loading, an error with a retry, or the text with Copy and Continue. */
export function HandoffPanel(props: {
  readonly title: string;
  readonly state: HandoffState;
  readonly onRetry: () => void;
  readonly onContinue: (prompt: string) => void;
}) {
  const { state } = props;
  const { copyToClipboard, isCopied } = useCopyToClipboard();

  if (state.status === "loading") {
    return (
      <p role="status" className="flex items-center gap-2 py-2 pl-1 text-xs text-muted-foreground">
        <Spinner size="sm" /> Writing the prompt...
      </p>
    );
  }
  if (state.status === "error") {
    return (
      <div role="alert" className="flex items-center gap-2 py-2 pl-1 text-xs">
        <span>{state.message}</span>
        <Button size="xs" variant="outline" onClick={props.onRetry}>
          Try again
        </Button>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-2 py-2 pl-1">
      <Textarea
        readOnly
        aria-label={`Handoff prompt for ${props.title}`}
        value={state.prompt}
        rows={6}
      />
      <div className="flex gap-2">
        <Button
          size="xs"
          variant="outline"
          onClick={() => copyToClipboard(state.prompt, undefined)}
        >
          {isCopied ? "Copied" : "Copy"}
        </Button>
        <Button size="xs" onClick={() => props.onContinue(state.prompt)}>
          Continue in a new chat
        </Button>
      </div>
    </div>
  );
}
