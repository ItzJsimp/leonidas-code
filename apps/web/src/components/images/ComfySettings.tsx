import type { ImageSourceStatus } from "@t3tools/contracts";
import { useState } from "react";

import { cn } from "~/lib/utils";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Hint } from "./Hint";

/** The ComfyUI connection: status and the address field. */
export function ComfySettings(props: {
  readonly source: ImageSourceStatus | null;
  readonly onSave: (baseUrl: string) => Promise<boolean>;
}) {
  const { source } = props;
  const [draft, setDraft] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const value = draft ?? source?.baseUrl ?? "";
  const changed = draft !== null && draft.trim() !== (source?.baseUrl ?? "");

  const save = async () => {
    setSaving(true);
    const saved = await props.onSave(value.trim());
    setSaving(false);
    if (saved) setDraft(null);
  };

  return (
    <section className="flex flex-col gap-3 rounded-2xl border bg-card p-5 shadow-xs/5">
      <div className="flex items-center gap-2">
        <span
          aria-hidden
          className={cn(
            "size-2 shrink-0 rounded-full",
            source?.online ? "bg-success" : "bg-warning",
          )}
        />
        <h2 className="text-sm font-semibold tracking-tight">ComfyUI connection</h2>
      </div>
      <p className="text-sm text-muted-foreground" aria-live="polite">
        {source === null
          ? "Checking..."
          : source.online
            ? "Connected. Images are made on this computer."
            : (source.message ?? "Not connected.")}
      </p>
      {source && !source.online ? (
        <p className="text-xs text-muted-foreground">
          ComfyUI is a free program that makes the images. Start it, then this page connects by
          itself.
        </p>
      ) : null}
      <div className="flex gap-2">
        <Hint
          block
          tip="The web address of your ComfyUI. The usual one is http://127.0.0.1:8188, which means this computer."
        >
          <Input
            aria-label="ComfyUI address"
            size="sm"
            font="mono"
            value={value}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && changed) void save();
            }}
          />
        </Hint>
        <Hint tip="Saves the address and checks the connection. It costs nothing.">
          <Button
            size="sm"
            variant="outline"
            disabled={!changed || saving}
            onClick={() => void save()}
          >
            Save
          </Button>
        </Hint>
      </div>
    </section>
  );
}
