import { useState } from "react";

import { DEFAULT_AIOS_FOLDER } from "../../../onboarding/leonidasSetup.logic";
import { SETUP_COPY, voiceFor } from "../../../onboarding/setupCopy";
import { coderPreselect } from "../../../onboarding/setupState.logic";
import { Button } from "../../ui/button";
import { Input } from "../../ui/input";
import { Radio, RadioGroup } from "../../ui/radio-group";

export interface SetupBasics {
  readonly aiName: string;
  readonly userName: string;
  readonly folder: string;
  readonly coder: boolean | null;
}

export const DEFAULT_AI_NAME = "Leonidas";

/** Screen 1 of 3. Only the AI name is required, and it starts filled in. */
export function SetupBasicsScreen({
  editorIds,
  initial,
  onContinue,
}: {
  readonly editorIds: readonly string[];
  readonly initial?: Partial<SetupBasics>;
  readonly onContinue: (basics: SetupBasics) => void;
}) {
  const [aiName, setAiName] = useState(initial?.aiName ?? DEFAULT_AI_NAME);
  const [userName, setUserName] = useState(initial?.userName ?? "");
  const [folder, setFolder] = useState(initial?.folder ?? DEFAULT_AIOS_FOLDER);
  const [coder, setCoder] = useState<boolean | null>(
    () => initial?.coder ?? coderPreselect(editorIds),
  );
  const copy = SETUP_COPY[voiceFor(coder)];
  const canContinue = aiName.trim() !== "";

  return (
    <form
      className="space-y-5"
      onSubmit={(event) => {
        event.preventDefault();
        if (!canContinue) return;
        onContinue({
          aiName: aiName.trim(),
          userName: userName.trim(),
          folder: folder.trim() || DEFAULT_AIOS_FOLDER,
          coder,
        });
      }}
    >
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{copy.basicsTitle}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{copy.basicsLead}</p>
      </div>
      <label className="block space-y-1.5">
        <span className="text-sm font-medium">{copy.aiNameLabel}</span>
        <Input
          autoFocus
          required
          maxLength={40}
          value={aiName}
          onChange={(event) => setAiName(event.currentTarget.value)}
        />
      </label>
      <label className="block space-y-1.5">
        <span className="text-sm font-medium">
          {copy.userNameLabel}
          <span className="ml-1.5 text-xs font-normal text-muted-foreground">Optional</span>
        </span>
        <Input
          maxLength={60}
          value={userName}
          onChange={(event) => setUserName(event.currentTarget.value)}
        />
      </label>
      <label className="block space-y-1.5">
        <span className="text-sm font-medium">{copy.folderLabel}</span>
        <Input
          spellCheck={false}
          value={folder}
          onChange={(event) => setFolder(event.currentTarget.value)}
        />
        <span className="block text-xs text-muted-foreground">{copy.folderWhy}</span>
      </label>
      <fieldset className="space-y-1.5">
        <legend className="text-sm font-medium">{copy.coderQuestion}</legend>
        <RadioGroup
          aria-label={copy.coderQuestion}

          value={coder === null ? "" : coder ? "yes" : "no"}
          onValueChange={(value) => setCoder(value === "yes")}
        >
          {(["yes", "no"] as const).map((value) => (
            <label
              key={value}
              className="flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm"
            >
              <Radio value={value} />
              {value === "yes" ? "Yes" : "No"}
            </label>
          ))}
        </RadioGroup>
        <p className="text-xs text-muted-foreground">{copy.coderHint}</p>
      </fieldset>
      <div className="flex justify-end">
        <Button type="submit" disabled={!canContinue}>
          Continue
        </Button>
      </div>
    </form>
  );
}
