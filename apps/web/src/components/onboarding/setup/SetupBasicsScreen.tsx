import { FolderIcon } from "lucide-react";
import { useEffect, useState } from "react";

import { DEFAULT_AIOS_FOLDER, aiosFolderFromPick } from "../../../onboarding/leonidasSetup.logic";
import { BASICS_COPY, aiNameSuggestions, surpriseName } from "../../../onboarding/setupCopy";
import { coderPreselect } from "../../../onboarding/setupState.logic";
import { cn } from "~/lib/utils";
import { Button } from "../../ui/button";
import { Input } from "../../ui/input";

export interface SetupBasics {
  readonly aiName: string;
  readonly userName: string;
  readonly folder: string;
  /** From installed code editors, never asked: it only sets the tour depth. */
  readonly coder: boolean | null;
}

export const DEFAULT_AI_NAME = "Leonidas";

const CHIP =
  "rounded-full px-3 py-1 text-xs ring-1 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring";

/** Screen 1 of 3. Every field starts filled in, so Continue alone is enough. */
export function SetupBasicsScreen({
  editorIds,
  initial,
  onContinue,
  onReturning,
  pickFolder,
  resolveFolder,
}: {
  readonly editorIds: readonly string[];
  readonly initial?: Partial<SetupBasics> | undefined;
  readonly onContinue: (basics: SetupBasics) => void;
  /** Shows the "already use Leonidas" link; absent where that path is not offered. */
  readonly onReturning?: (() => void) | undefined;
  /** The system folder picker; absent in a plain browser, where the path is typed instead. */
  readonly pickFolder?: (() => Promise<string | null>) | undefined;
  /** Turns `~/Leonidas AIOS` into the real path on the user's computer. */
  readonly resolveFolder?: ((folder: string) => Promise<string>) | undefined;
}) {
  const [aiName, setAiName] = useState(initial?.aiName ?? DEFAULT_AI_NAME);
  const [userName, setUserName] = useState(initial?.userName ?? "");
  const [folder, setFolder] = useState(initial?.folder ?? DEFAULT_AIOS_FOLDER);
  const [shownFolder, setShownFolder] = useState(folder);
  const [typingFolder, setTypingFolder] = useState(false);
  const canContinue = aiName.trim() !== "";

  useEffect(() => {
    setShownFolder(folder);
    if (!resolveFolder) return;
    let current = true;
    void resolveFolder(folder)
      .then((resolved) => current && setShownFolder(resolved))
      .catch(() => undefined);
    return () => {
      current = false;
    };
  }, [folder, resolveFolder]);

  const changeFolder = async () => {
    if (!pickFolder) {
      setTypingFolder(true);
      return;
    }
    const picked = await pickFolder().catch(() => null);
    if (picked) setFolder(aiosFolderFromPick(picked));
  };

  return (
    <form
      className="flex flex-1 flex-col gap-5"
      onSubmit={(event) => {
        event.preventDefault();
        if (!canContinue) return;
        onContinue({
          aiName: aiName.trim(),
          userName: userName.trim(),
          folder: folder.trim() || DEFAULT_AIOS_FOLDER,
          coder: initial?.coder ?? coderPreselect(editorIds),
        });
      }}
    >
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{BASICS_COPY.title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{BASICS_COPY.lead}</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block space-y-1.5">
          <span className="text-sm font-medium">
            {BASICS_COPY.userNameLabel}
            <span className="ml-1.5 text-xs font-normal text-muted-foreground">Optional</span>
          </span>
          <Input
            autoFocus
            maxLength={60}
            placeholder="Your first name"
            value={userName}
            onChange={(event) => setUserName(event.currentTarget.value)}
          />
        </label>
        <label className="block space-y-1.5">
          <span className="text-sm font-medium">{BASICS_COPY.aiNameLabel}</span>
          <Input
            required
            maxLength={40}
            value={aiName}
            onChange={(event) => setAiName(event.currentTarget.value)}
          />
        </label>
      </div>
      <div className="-mt-2 flex flex-wrap items-center gap-1.5" aria-label="Name ideas">
        {aiNameSuggestions(userName).map((idea) => (
          <button
            key={idea}
            type="button"
            aria-pressed={aiName === idea}
            className={cn(
              CHIP,
              aiName === idea
                ? "bg-primary/10 text-primary ring-primary/40"
                : "bg-card text-muted-foreground ring-black/10 hover:text-foreground dark:ring-white/10",
            )}
            onClick={() => setAiName(idea)}
          >
            {idea}
          </button>
        ))}
        <button
          type="button"
          className={cn(
            CHIP,
            "text-muted-foreground ring-dashed ring-black/10 hover:text-foreground dark:ring-white/10",
          )}
          onClick={() => setAiName(surpriseName(aiName))}
        >
          Surprise me
        </button>
      </div>
      <div className="space-y-1.5">
        <span className="block text-sm font-medium">{BASICS_COPY.folderLabel}</span>
        {typingFolder ? (
          <Input
            spellCheck={false}
            aria-label={BASICS_COPY.folderLabel}
            value={folder}
            onChange={(event) => setFolder(event.currentTarget.value)}
          />
        ) : (
          <div className="flex items-center gap-2 rounded-lg border bg-card px-3 py-1.5">
            <FolderIcon className="size-4 shrink-0 text-muted-foreground" />
            <span className="min-w-0 flex-1 truncate text-sm" title={shownFolder}>
              {shownFolder}
            </span>
            <Button type="button" size="xs" variant="outline" onClick={() => void changeFolder()}>
              Change
            </Button>
          </div>
        )}
        <span className="block text-xs text-muted-foreground">{BASICS_COPY.folderWhy}</span>
      </div>
      <div className="mt-auto flex items-center justify-between gap-3 pt-2">
        {onReturning ? (
          <Button type="button" variant="ghost-muted" size="sm" onClick={onReturning}>
            {BASICS_COPY.returning}
          </Button>
        ) : (
          <span />
        )}
        <Button type="submit" disabled={!canContinue}>
          Continue
        </Button>
      </div>
    </form>
  );
}
