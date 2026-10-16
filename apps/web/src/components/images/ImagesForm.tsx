import type { ImageItem, ImageModel, ProjectId } from "@t3tools/contracts";
import { SparklesIcon } from "lucide-react";
import { useMemo, useState } from "react";

import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Checkbox } from "../ui/checkbox";
import { Collapsible, CollapsiblePanel, CollapsibleTrigger } from "../ui/collapsible";
import { Input } from "../ui/input";
import { Select, SelectItem, SelectPopup, SelectTrigger, SelectValue } from "../ui/select";
import { Textarea } from "../ui/textarea";
import { Hint } from "./Hint";
import {
  clampVariations,
  commercialBadge,
  estimateRunSeconds,
  formatSeconds,
  parseSeedInput,
  promptHistory,
  toggleModel,
} from "./images.logic";

export interface ImagesFormValues {
  readonly prompt: string;
  readonly seed: string;
  readonly count: number;
  readonly modelIds: ReadonlyArray<string>;
}

function ModelRow(props: {
  readonly model: ImageModel;
  readonly checked: boolean;
  readonly onToggle: () => void;
}) {
  const { model } = props;
  const badge = commercialBadge(model.commercialUse, model.licence);
  return (
    <Hint
      block
      tip={`${model.label}. ${badge.tip} About ${formatSeconds(model.typicalSeconds)} per image on a 12 GB graphics card. ${model.sizeLabel} on disk. Runs on your computer, so it is free.`}
    >
      <label className="flex w-full cursor-pointer items-start gap-3 rounded-lg px-2 py-2 hover:bg-accent/50">
        <Checkbox
          className="mt-0.5"
          checked={props.checked}
          onCheckedChange={props.onToggle}
          aria-label={model.label}
        />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">{model.label}</span>
          <span className="block text-xs text-muted-foreground">
            {model.sizeLabel} · about {formatSeconds(model.typicalSeconds)} each
          </span>
        </span>
        <Badge variant={badge.variant} size="sm" className="mt-0.5 shrink-0">
          {badge.label}
        </Badge>
      </label>
    </Hint>
  );
}

export function ImagesForm(props: {
  readonly values: ImagesFormValues;
  readonly models: ReadonlyArray<ImageModel>;
  readonly items: ReadonlyArray<ImageItem>;
  readonly projects: ReadonlyArray<{ readonly id: ProjectId; readonly title: string }>;
  readonly projectId: ProjectId | null;
  readonly canStart: boolean;
  readonly onChange: (patch: Partial<ImagesFormValues> & { projectId?: string }) => void;
  readonly onGenerate: (seed: number | null) => void;
}) {
  const { values } = props;
  const [seedProblem, setSeedProblem] = useState(false);
  const history = useMemo(() => promptHistory(props.items, 10), [props.items]);
  const total = values.modelIds.length * values.count;
  const estimate = estimateRunSeconds(props.models, values.modelIds, values.count);
  const ready = props.canStart && values.prompt.trim() !== "" && total > 0;

  const submit = () => {
    const seed = parseSeedInput(values.seed);
    if (seed === "invalid") {
      setSeedProblem(true);
      return;
    }
    setSeedProblem(false);
    props.onGenerate(seed);
  };

  const project = props.projects.find((candidate) => candidate.id === props.projectId);

  return (
    <section className="flex flex-col gap-5 rounded-2xl border bg-card p-5 shadow-xs/5">
      {props.projects.length > 1 ? (
        <div className="flex flex-col gap-1.5">
          <label htmlFor="images-project" className="text-sm font-medium">
            Project
          </label>
          <Hint
            block
            tip="Images are saved in the images folder of this project. Each image has a recipe file next to it."
          >
            <Select
              value={props.projectId ?? ""}
              onValueChange={(value) => value && props.onChange({ projectId: value })}
            >
              <SelectTrigger id="images-project" aria-label="Project">
                <SelectValue>{project?.title ?? "Choose a project"}</SelectValue>
              </SelectTrigger>
              <SelectPopup alignItemWithTrigger={false}>
                {props.projects.map((candidate) => (
                  <SelectItem key={candidate.id} value={candidate.id}>
                    {candidate.title}
                  </SelectItem>
                ))}
              </SelectPopup>
            </Select>
          </Hint>
        </div>
      ) : null}

      <div className="flex flex-col gap-1.5">
        <label htmlFor="images-prompt" className="text-sm font-medium">
          Prompt
        </label>
        <Hint block tip="Describe the picture you want. Every chosen model gets the same words.">
          <Textarea
            id="images-prompt"
            value={values.prompt}
            maxLength={4000}
            placeholder="cute mint-green ghost slime, sticker cartoon, white background, no text"
            onChange={(event) => props.onChange({ prompt: event.target.value })}
            onKeyDown={(event) => {
              if (event.key === "Enter" && (event.metaKey || event.ctrlKey) && ready) {
                event.preventDefault();
                submit();
              }
            }}
          />
        </Hint>
        {history.length > 0 ? (
          <Collapsible>
            <Hint tip="Shows the prompts you used before. Press one to put it back in the prompt box.">
              <CollapsibleTrigger className="text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline">
                Earlier prompts ({history.length})
              </CollapsibleTrigger>
            </Hint>
            <CollapsiblePanel>
              <ul className="mt-2 flex flex-col gap-1">
                {history.map((prompt) => (
                  <li key={prompt}>
                    <button
                      type="button"
                      title={prompt}
                      onClick={() => props.onChange({ prompt })}
                      className="w-full truncate rounded-md px-2 py-1 text-left text-xs text-muted-foreground outline-hidden hover:bg-accent/50 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      {prompt}
                    </button>
                  </li>
                ))}
              </ul>
            </CollapsiblePanel>
          </Collapsible>
        ) : null}
      </div>

      <fieldset className="flex flex-col gap-1">
        <legend className="mb-1 text-sm font-medium">Models</legend>
        {props.models.length === 0 ? (
          <p className="text-sm text-muted-foreground">Models appear when the app connects.</p>
        ) : (
          props.models.map((model) => (
            <ModelRow
              key={model.id}
              model={model}
              checked={values.modelIds.includes(model.id)}
              onToggle={() => props.onChange({ modelIds: toggleModel(values.modelIds, model.id) })}
            />
          ))
        )}
      </fieldset>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="images-seed" className="text-sm font-medium">
            Seed
          </label>
          <Hint
            block
            tip="A number that picks the random start. The same seed and prompt make the same picture. Leave empty for a random one."
          >
            <Input
              id="images-seed"
              inputMode="numeric"
              placeholder="Random"
              value={values.seed}
              aria-invalid={seedProblem}
              onChange={(event) => {
                setSeedProblem(false);
                props.onChange({ seed: event.target.value });
              }}
            />
          </Hint>
          {seedProblem ? (
            <p className="text-xs text-destructive-foreground">
              Use a whole number, or leave empty.
            </p>
          ) : null}
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="images-count" className="text-sm font-medium">
            Variations
          </label>
          <Hint
            block
            tip="How many pictures to make per model, from 1 to 12. They use the seed, then seed + 1, and so on."
          >
            <Input
              id="images-count"
              type="number"
              min={1}
              max={12}
              value={values.count}
              onChange={(event) =>
                props.onChange({ count: clampVariations(Number(event.target.value)) })
              }
            />
          </Hint>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Hint
          block
          tip="Starts the images on your computer, one at a time. It costs nothing. Press Cancel waiting to stop the rest."
        >
          <Button className="w-full" size="lg" disabled={!ready} onClick={submit}>
            <SparklesIcon />
            {total > 1 ? `Generate ${String(total)} images` : "Generate"}
          </Button>
        </Hint>
        <p className="text-xs text-muted-foreground">
          {!props.canStart
            ? "Add a project first. Images are saved in its folder."
            : values.prompt.trim() === ""
              ? "Write a prompt to start."
              : total === 0
                ? "Tick at least one model."
                : `Free, runs on your computer. About ${formatSeconds(estimate)} in total.`}
        </p>
      </div>
    </section>
  );
}
