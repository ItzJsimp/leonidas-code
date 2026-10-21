import { useState } from "react";

import { useCopyToClipboard } from "../../../hooks/useCopyToClipboard";
import { IMPORT_MEMORY_PROMPT, MAX_IMPORT_LENGTH } from "../../../onboarding/setupCopy";
import { Button } from "../../ui/button";
import { Spinner } from "../../ui/spinner";
import { Textarea } from "../../ui/textarea";

type ImportState =
  | { readonly status: "closed" }
  | { readonly status: "open"; readonly error?: string }
  | { readonly status: "saving" }
  | { readonly status: "saved" };

/** Copy a prompt to another AI, paste its answer back, save it as memory. Used on screen 3 and the checklist. */
export function MemoryImportPanel({
  lead,
  onSave,
}: {
  readonly lead: string;
  /** Resolves to an error message, or null when the memory file was saved. */
  readonly onSave: (pasted: string) => Promise<string | null>;
}) {
  const [state, setState] = useState<ImportState>({ status: "closed" });
  const [pasted, setPasted] = useState("");
  const { copyToClipboard, isCopied } = useCopyToClipboard();

  if (state.status === "saved") {
    return (
      <p role="status" className="rounded-lg border p-3 text-sm">
        Memory imported. Your AI reads it from now on.
      </p>
    );
  }
  if (state.status === "closed") {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3">
        <p className="text-sm text-muted-foreground">{lead}</p>
        <Button variant="outline" size="sm" onClick={() => setState({ status: "open" })}>
          Import memory from another AI
        </Button>
      </div>
    );
  }
  const saving = state.status === "saving";
  return (
    <div className="space-y-3 rounded-lg border p-3">
      <p className="text-sm font-medium">Import memory from another AI</p>
      <ol className="list-decimal space-y-3 pl-5 text-sm">
        <li className="space-y-2">
          <span className="block">
            Copy this prompt and send it to ChatGPT, Claude or another AI.
          </span>
          <Button variant="outline" size="sm" onClick={() => copyToClipboard(IMPORT_MEMORY_PROMPT)}>
            {isCopied ? "Copied" : "Copy prompt"}
          </Button>
        </li>
        <li className="space-y-2">
          <label className="block space-y-1.5">
            <span className="block">Paste its whole answer here.</span>
            <Textarea
              maxLength={MAX_IMPORT_LENGTH}
              rows={5}
              value={pasted}
              onChange={(event) => setPasted(event.currentTarget.value)}
            />
          </label>
        </li>
      </ol>
      {state.status === "open" && state.error ? (
        <p role="alert" className="text-xs text-destructive-foreground">
          {state.error}
        </p>
      ) : null}
      <div className="flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={() => setState({ status: "closed" })}>
          Cancel
        </Button>
        <Button
          size="sm"
          disabled={pasted.trim() === "" || saving}
          onClick={async () => {
            setState({ status: "saving" });
            const error = await onSave(pasted);
            setState(error === null ? { status: "saved" } : { status: "open", error });
          }}
        >
          {saving ? <Spinner /> : null}
          Save to memory
        </Button>
      </div>
    </div>
  );
}
