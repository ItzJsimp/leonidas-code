import type { ImageCatalogModel } from "@t3tools/contracts";
import {
  DicesIcon,
  LockIcon,
  LockOpenIcon,
  PlusIcon,
  RotateCcwIcon,
  SparklesIcon,
  XIcon,
} from "lucide-react";
import { useId, useMemo, useState } from "react";

import { Button } from "../ui/button";
import { Collapsible, CollapsiblePanel, CollapsibleTrigger } from "../ui/collapsible";
import { Input } from "../ui/input";
import {
  NumberField,
  NumberFieldDecrement,
  NumberFieldGroup,
  NumberFieldIncrement,
  NumberFieldInput,
} from "../ui/number-field";
import { Select, SelectItem, SelectPopup, SelectTrigger, SelectValue } from "../ui/select";
import { Textarea } from "../ui/textarea";
import { DictationTextarea } from "../voice/DictationTextarea";
import { Toggle, ToggleGroup } from "../ui/toggle-group";
import { FitBadge, HelpText } from "./catalogBadges";
import {
  ASPECTS,
  SIZES,
  dimensionsFor,
  estimateRunRange,
  formatRange,
  modelTimeShort,
  needsConfirm,
  randomSeed,
  resolveSeed,
  type AspectId,
  type SizeId,
} from "./catalog.logic";
import { MAX_VARIATIONS, promptHistory } from "./images.logic";
import type { GalleryItem } from "./images.mock";
import type { CreateMemory } from "./useCreateMemory";
import type { GenerateRequest } from "./useImagesCatalog";

/** True when the model can make an image now. */
const canRun = (model: ImageCatalogModel) => model.state === "ready" && model.fit !== "too-big";

function SectionLabel(props: {
  readonly htmlFor?: string;
  readonly children: string;
  readonly id?: string;
}) {
  return props.htmlFor ? (
    <label htmlFor={props.htmlFor} id={props.id} className="text-sm font-medium">
      {props.children}
    </label>
  ) : (
    <span id={props.id} className="text-sm font-medium">
      {props.children}
    </span>
  );
}

function ModelChip(props: { readonly model: ImageCatalogModel; readonly onRemove: () => void }) {
  const { model } = props;
  const skipped = !canRun(model);
  return (
    <li className="flex min-h-11 items-center gap-2 rounded-lg border bg-background py-1 ps-3 pe-1 sm:min-h-9">
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{model.label}</span>
        <span className="block text-xs text-muted-foreground">
          {skipped
            ? model.state === "ready"
              ? "Skipped: too big for your card"
              : "Skipped: not installed"
            : `${modelTimeShort(model)} each`}
        </span>
      </span>
      <FitBadge model={model} size="sm" />
      <Button
        size="icon-sm"
        variant="ghost-muted"
        className="pointer-coarse:size-10"
        aria-label={`Remove ${model.label}`}
        onClick={props.onRemove}
      >
        <XIcon />
      </Button>
    </li>
  );
}

export function CreateView(props: {
  readonly memory: CreateMemory;
  readonly onChange: (patch: Partial<CreateMemory>) => void;
  readonly catalog: ReadonlyArray<ImageCatalogModel>;
  readonly items: ReadonlyArray<GalleryItem>;
  readonly online: boolean;
  /** The first connection check has not answered yet. */
  readonly checking?: boolean;
  /** False when the server ignores size, steps, guidance and the negative prompt. */
  readonly canAdjust: boolean;
  readonly onGenerate: (request: GenerateRequest) => void;
  readonly onOpenModels: () => void;
}) {
  const { memory, onChange, catalog } = props;
  const ids = useId();
  const [seedProblem, setSeedProblem] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const history = useMemo(() => promptHistory(props.items, 10), [props.items]);

  const selected = useMemo(
    () =>
      memory.modelIds.flatMap((id) => {
        const model = catalog.find((entry) => entry.id === id);
        return model ? [model] : [];
      }),
    [catalog, memory.modelIds],
  );
  const runnable = selected.filter(canRun);
  const range = estimateRunRange(runnable, memory.count);
  const total = runnable.length * memory.count;
  const confirm = needsConfirm(range);
  const { width, height } = dimensionsFor(memory.aspect, memory.size);
  const advancedChanged =
    memory.steps !== null ||
    memory.guidance !== null ||
    memory.sampler !== null ||
    memory.negativePrompt !== "";

  const blocker = !props.online
    ? props.checking
      ? "Checking the ComfyUI connection..."
      : "Start ComfyUI first. See the setup steps above."
    : memory.prompt.trim() === ""
      ? "Write a prompt to start."
      : selected.length === 0
        ? "Choose at least one model."
        : runnable.length === 0
          ? "None of the chosen models can run. Install one, or choose a model that fits."
          : null;

  const change = (patch: Partial<CreateMemory>) => {
    setConfirming(false);
    onChange(patch);
  };

  const submit = () => {
    if (blocker) return;
    const seed = resolveSeed(memory.seedMode, memory.seed);
    if (seed === "invalid") {
      setSeedProblem(true);
      return;
    }
    if (confirm && !confirming) {
      setConfirming(true);
      return;
    }
    setConfirming(false);
    setSeedProblem(false);
    if (memory.seedMode === "random") onChange({ seed: String(seed) });
    props.onGenerate({
      prompt: memory.prompt.trim(),
      modelIds: runnable.map((model) => model.id),
      count: memory.count,
      seed,
      width,
      height,
      steps: memory.steps,
      guidance: memory.guidance,
      sampler: memory.sampler,
      negativePrompt: memory.negativePrompt.trim(),
    });
  };

  return (
    <section
      aria-label="Create images"
      className="flex flex-col gap-6 rounded-2xl border bg-card p-4 shadow-xs/5 sm:p-5"
    >
      {/* Prompt */}
      <div className="flex flex-col gap-2">
        <SectionLabel htmlFor={`${ids}-prompt`}>Prompt</SectionLabel>
        <DictationTextarea
          id={`${ids}-prompt`}
          value={memory.prompt}
          maxLength={4000}
          aria-describedby={`${ids}-prompt-help`}
          placeholder="Describe the picture you want"
          onChange={(event) => change({ prompt: event.target.value })}
          onKeyDown={(event) => {
            if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
              event.preventDefault();
              submit();
            }
          }}
        />
        <HelpText id={`${ids}-prompt-help`}>
          Every chosen model gets the same words. Press Ctrl+Enter to start.
        </HelpText>
        {history.length > 0 ? (
          <Collapsible>
            <CollapsibleTrigger className="min-h-8 rounded text-xs text-muted-foreground underline-offset-2 outline-hidden hover:text-foreground hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset">
              Earlier prompts ({history.length})
            </CollapsibleTrigger>
            <CollapsiblePanel>
              <ul className="mt-1 flex flex-col gap-0.5">
                {history.map((prompt) => (
                  <li key={prompt}>
                    <button
                      type="button"
                      onClick={() => change({ prompt })}
                      className="min-h-9 w-full truncate rounded-md px-2 py-1 text-left text-xs text-muted-foreground outline-hidden hover:bg-accent/50 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
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

      {/* Models */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <SectionLabel id={`${ids}-models`}>{`Models (${String(selected.length)})`}</SectionLabel>
          <Button size="sm" variant="outline" onClick={props.onOpenModels}>
            <PlusIcon />
            Add or change
          </Button>
        </div>
        {selected.length === 0 ? (
          <HelpText>No model chosen. Open Models to choose some.</HelpText>
        ) : (
          <ul aria-labelledby={`${ids}-models`} className="flex flex-col gap-1.5">
            {selected.map((model) => (
              <ModelChip
                key={model.id}
                model={model}
                onRemove={() =>
                  change({ modelIds: memory.modelIds.filter((id) => id !== model.id) })
                }
              />
            ))}
          </ul>
        )}
      </div>

      {/* Images per model and Seed */}
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <SectionLabel htmlFor={`${ids}-count`}>Images per model</SectionLabel>
          <NumberField
            id={`${ids}-count`}
            value={memory.count}
            min={1}
            max={MAX_VARIATIONS}
            onValueChange={(value) => change({ count: value ?? 1 })}
            aria-describedby={`${ids}-count-help`}
          >
            <NumberFieldGroup>
              <NumberFieldDecrement aria-label="Fewer images" />
              <NumberFieldInput />
              <NumberFieldIncrement aria-label="More images" />
            </NumberFieldGroup>
          </NumberField>
          <HelpText id={`${ids}-count-help`}>
            Each picture uses the next seed. From 1 to {MAX_VARIATIONS}.
          </HelpText>
        </div>

        <div className="flex flex-col gap-2">
          <SectionLabel id={`${ids}-seed`}>Seed</SectionLabel>
          <ToggleGroup
            aria-labelledby={`${ids}-seed`}
            className="w-full *:flex-1 *:pointer-coarse:min-h-11"
            value={[memory.seedMode]}
            onValueChange={(next) => {
              const mode = next[0];
              if (mode !== "random" && mode !== "fixed") return;
              setSeedProblem(false);
              change({
                seedMode: mode,
                seed: mode === "fixed" && memory.seed === "" ? String(randomSeed()) : memory.seed,
              });
            }}
          >
            <Toggle value="random">Random</Toggle>
            <Toggle value="fixed">Fixed</Toggle>
          </ToggleGroup>
          {memory.seedMode === "fixed" ? (
            <div className="flex gap-1.5">
              <Input
                aria-label="Seed number"
                inputMode="numeric"
                font="mono"
                value={memory.seed}
                disabled={memory.seedLocked}
                aria-invalid={seedProblem}
                onChange={(event) => {
                  setSeedProblem(false);
                  change({ seed: event.target.value });
                }}
              />
              <Button
                size="icon"
                variant="outline"
                className="pointer-coarse:size-11"
                aria-label="New random seed number"
                disabled={memory.seedLocked}
                onClick={() => change({ seed: String(randomSeed()) })}
              >
                <DicesIcon />
              </Button>
              <Button
                size="icon"
                variant={memory.seedLocked ? "secondary" : "outline"}
                className="pointer-coarse:size-11"
                aria-pressed={memory.seedLocked}
                aria-label={memory.seedLocked ? "Unlock the seed" : "Lock the seed"}
                onClick={() => change({ seedLocked: !memory.seedLocked })}
              >
                {memory.seedLocked ? <LockIcon /> : <LockOpenIcon />}
              </Button>
            </div>
          ) : null}
          {seedProblem ? (
            <p className="text-xs text-destructive-foreground" role="alert">
              Use a whole number from 0 to 4294967295.
            </p>
          ) : null}
          <HelpText>
            Same seed + same prompt + same model = same picture.{" "}
            {memory.seedMode === "random"
              ? "Random picks a new seed for each press."
              : memory.seedLocked
                ? "The lock stops changes to the number."
                : "Change one word and keep the seed to adjust a picture you like."}
          </HelpText>
        </div>
      </div>

      {props.canAdjust ? (
        <>
          {/* Shape */}
          <div className="flex flex-col gap-2">
            <SectionLabel id={`${ids}-shape`}>Shape and size</SectionLabel>
            <ToggleGroup
              aria-labelledby={`${ids}-shape`}
              className="w-full *:flex-1 *:pointer-coarse:min-h-11"
              value={[memory.aspect]}
              onValueChange={(next) => {
                const value = next[0] as AspectId | undefined;
                if (value) change({ aspect: value });
              }}
            >
              {ASPECTS.map((aspect) => (
                <Toggle key={aspect.id} value={aspect.id}>
                  {aspect.label}
                </Toggle>
              ))}
            </ToggleGroup>
            <ToggleGroup
              aria-label="Size"
              className="w-full *:flex-1 *:pointer-coarse:min-h-11"
              value={[memory.size]}
              onValueChange={(next) => {
                const value = next[0] as SizeId | undefined;
                if (value) change({ size: value });
              }}
            >
              {SIZES.map((size) => (
                <Toggle key={size.id} value={size.id}>
                  {size.label}
                </Toggle>
              ))}
            </ToggleGroup>
            <HelpText className="tabular-nums">
              {width} × {height} pixels. Bigger pictures take longer.
            </HelpText>
          </div>

          {/* Advanced */}
          <Collapsible defaultOpen={advancedChanged}>
            <CollapsibleTrigger className="flex min-h-11 w-full items-center justify-between rounded-lg border px-3 text-sm font-medium outline-hidden hover:bg-accent/50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset sm:min-h-9">
              <span>Advanced settings</span>
              <span className="text-xs font-normal text-muted-foreground">
                {advancedChanged ? "Changed" : "Model defaults"}
              </span>
            </CollapsibleTrigger>
            <CollapsiblePanel>
              <AdvancedPanel memory={memory} selected={selected} onChange={change} />
            </CollapsiblePanel>
          </Collapsible>
        </>
      ) : null}

      {/* Generate */}
      <div className="flex flex-col gap-2">
        {confirming ? (
          <div
            role="alert"
            className="flex flex-col gap-2 rounded-lg border border-warning/40 bg-warning/8 p-3 text-sm"
          >
            <p>
              This run makes <strong>{total}</strong> images and takes{" "}
              <strong>{formatRange(range)}</strong>. Start it?
            </p>
            <div className="flex gap-2">
              <Button size="sm" onClick={submit}>
                Start {total} images
              </Button>
              <Button size="sm" variant="outline" onClick={() => setConfirming(false)}>
                Ask me later
              </Button>
            </div>
          </div>
        ) : null}
        <Button
          className="w-full max-sm:h-12"
          size="lg"
          disabled={blocker !== null}
          onClick={submit}
        >
          <SparklesIcon />
          {total > 1 ? `Generate ${String(total)} images` : "Generate"}
        </Button>
        <HelpText>
          {blocker ??
            `${formatRange(range)} in total, model load time included. Free: it runs on your PC.`}
        </HelpText>
      </div>
    </section>
  );
}

function AdvancedPanel(props: {
  readonly memory: CreateMemory;
  readonly selected: ReadonlyArray<ImageCatalogModel>;
  readonly onChange: (patch: Partial<CreateMemory>) => void;
}) {
  const { memory, selected, onChange } = props;
  const ids = useId();
  const samplers = useMemo(
    () => [...new Set(selected.flatMap((model) => model.samplers))],
    [selected],
  );
  return (
    <div className="mt-3 flex flex-col gap-4">
      <HelpText>
        Empty fields use the default of each model. A value outside the range of a model moves to
        the nearest value that model accepts.
      </HelpText>
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <SectionLabel htmlFor={`${ids}-steps`}>Steps</SectionLabel>
          <NumberField
            id={`${ids}-steps`}
            value={memory.steps}
            min={1}
            max={100}
            onValueChange={(value) => onChange({ steps: value })}
          >
            <NumberFieldGroup>
              <NumberFieldInput placeholder="Default" />
            </NumberFieldGroup>
          </NumberField>
          <HelpText>More steps: more detail, more time.</HelpText>
        </div>
        <div className="flex flex-col gap-1.5">
          <SectionLabel htmlFor={`${ids}-guidance`}>Guidance</SectionLabel>
          <NumberField
            id={`${ids}-guidance`}
            value={memory.guidance}
            min={0}
            max={20}
            step={0.5}
            onValueChange={(value) => onChange({ guidance: value })}
          >
            <NumberFieldGroup>
              <NumberFieldInput placeholder="Default" />
            </NumberFieldGroup>
          </NumberField>
          <HelpText>Higher: follows the prompt more closely.</HelpText>
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <SectionLabel htmlFor={`${ids}-sampler`}>Sampler</SectionLabel>
        <Select
          value={memory.sampler ?? ""}
          onValueChange={(value) => onChange({ sampler: value ? value : null })}
        >
          <SelectTrigger id={`${ids}-sampler`} aria-label="Sampler">
            <SelectValue>{memory.sampler ?? "Model default"}</SelectValue>
          </SelectTrigger>
          <SelectPopup alignItemWithTrigger={false}>
            <SelectItem value="">Model default</SelectItem>
            {samplers.map((sampler) => (
              <SelectItem key={sampler} value={sampler}>
                {sampler}
              </SelectItem>
            ))}
          </SelectPopup>
        </Select>
        <HelpText>
          The method that removes noise step by step. The default is usually best.
        </HelpText>
      </div>
      <div className="flex flex-col gap-1.5">
        <SectionLabel htmlFor={`${ids}-negative`}>Things to avoid</SectionLabel>
        <Textarea
          id={`${ids}-negative`}
          value={memory.negativePrompt}
          placeholder="For example: blurry, text, watermark"
          onChange={(event) => onChange({ negativePrompt: event.target.value })}
        />
        <HelpText>Also called the negative prompt. Some fast models ignore it.</HelpText>
      </div>
      {selected.length > 0 ? (
        <table className="w-full text-left text-xs">
          <caption className="mb-1 text-left text-xs font-medium">
            Defaults of the chosen models
          </caption>
          <thead className="text-muted-foreground">
            <tr>
              <th className="py-1 font-medium">Model</th>
              <th className="py-1 font-medium">Steps (range)</th>
              <th className="py-1 font-medium">Guidance (range)</th>
            </tr>
          </thead>
          <tbody className="tabular-nums">
            {selected.map((model) => (
              <tr key={model.id} className="border-t">
                <td className="py-1 pe-2">{model.label}</td>
                <td className="py-1">
                  {model.defaults.steps} ({model.ranges.steps.min} to {model.ranges.steps.max})
                </td>
                <td className="py-1">
                  {model.defaults.guidance} ({model.ranges.guidance.min} to{" "}
                  {model.ranges.guidance.max})
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
      <Button
        size="sm"
        variant="outline"
        className="self-start"
        onClick={() => onChange({ steps: null, guidance: null, sampler: null, negativePrompt: "" })}
      >
        <RotateCcwIcon />
        Reset to model defaults
      </Button>
    </div>
  );
}
