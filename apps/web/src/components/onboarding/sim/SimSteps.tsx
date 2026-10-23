import { ArrowRightIcon, CheckIcon, CopyIcon, MonitorIcon } from "lucide-react";
import { useEffect, useState } from "react";

import { buildAiosFoldersCommand } from "../../../onboarding/aiosFolders.logic";
import {
  AIOS_PRESET,
  buildAiosSetupPrompt,
  DEFAULT_AIOS_FOLDER,
  LEONIDAS_GOALS,
  toggleGoal,
} from "../../../onboarding/leonidasSetup.logic";
import { suggestSkills } from "../../../onboarding/skillPacks";
import { PRIVACY_POLICY_URL } from "../../../legalLinks";
import { Button } from "../../ui/button";
import { Checkbox } from "../../ui/checkbox";
import { Collapsible, CollapsiblePanel, CollapsibleTrigger } from "../../ui/collapsible";
import { Input } from "../../ui/input";
import { ScrollArea } from "../../ui/scroll-area";
import { Spinner } from "../../ui/spinner";
import type { SimPersona } from "./onboardingSim.logic";

const SCROLL = "mt-5 h-auto max-h-[min(32rem,55dvh)]";
const H1 = "text-2xl font-semibold tracking-tight text-foreground";
const LEDE = "mt-2.5 text-sm leading-relaxed text-muted-foreground";

export function SimWelcomeStep({
  goals,
  onGoals,
  onContinue,
}: {
  readonly goals: readonly string[];
  readonly onGoals: (next: readonly string[]) => void;
  readonly onContinue: () => void;
}) {
  return (
    <>
      <h1 className={H1}>Welcome to Leonidas</h1>
      <p className={LEDE}>
        What will you mostly use it for? Pick all that fit. We will pick skills and setup to match.
      </p>
      <ScrollArea scrollFade className={SCROLL}>
        <div className="grid grid-cols-1 gap-1 pr-3 sm:grid-cols-2">
          {LEONIDAS_GOALS.map((goal) => (
            <label
              key={goal.id}
              className="flex cursor-pointer items-start gap-2.5 rounded-md px-2 py-2 hover:bg-muted/40"
            >
              <Checkbox
                checked={goals.includes(goal.id)}
                onCheckedChange={() => onGoals(toggleGoal(goals, goal.id))}
              />
              <span className="min-w-0">
                <span className="block text-sm font-medium">{goal.label}</span>
                <span className="block text-xs text-muted-foreground">{goal.hint}</span>
              </span>
            </label>
          ))}
        </div>
      </ScrollArea>
      <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
        Leonidas collects anonymous usage data to help us improve it. To learn how we use your data
        and how to opt out, read our{" "}
        <a
          className="underline underline-offset-2"
          href={PRIVACY_POLICY_URL}
          target="_blank"
          rel="noreferrer noopener"
        >
          privacy policy
        </a>
        .
      </p>
      <div className="mt-6 flex justify-end">
        <Button autoFocus onClick={onContinue}>
          Continue
          <ArrowRightIcon className="size-3.5" />
        </Button>
      </div>
    </>
  );
}

export function SimConnectStep({ onContinue }: { readonly onContinue: () => void }) {
  const [checked, setChecked] = useState(true);
  const [pairingOpen, setPairingOpen] = useState(false);
  return (
    <>
      <h1 className={H1}>Connect your computers</h1>
      <p className={LEDE}>
        Choose one or more computers. We will set up AI accounts and projects on each one.
      </p>
      <fieldset className="mt-5 space-y-2">
        <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-border bg-background px-3 py-3">
          <Checkbox checked={checked} onCheckedChange={(value) => setChecked(value === true)} />
          <MonitorIcon className="size-4 shrink-0 text-muted-foreground" />
          <span className="flex min-w-0 flex-1 items-baseline justify-between gap-3">
            <span className="text-sm font-medium">This computer</span>
            <span className="text-xs text-muted-foreground">Connected</span>
          </span>
        </label>
      </fieldset>
      <div className="mt-4 rounded-lg border border-border bg-background">
        <Collapsible open={pairingOpen} onOpenChange={setPairingOpen}>
          <CollapsibleTrigger
            render={
              <Button
                variant="ghost"
                size="sm-multiline"
                className="min-h-14 w-full justify-start"
              />
            }
          >
            <span className="flex-1 text-left">Add a computer</span>
          </CollapsibleTrigger>
          <CollapsiblePanel>
            <p className="px-3 pb-3 text-sm text-muted-foreground">Paste a connection link.</p>
          </CollapsiblePanel>
        </Collapsible>
      </div>
      <div className="mt-6 flex flex-col-reverse gap-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
        <p className="min-w-0 text-xs leading-relaxed text-muted-foreground">
          Leonidas collects anonymous usage data to help us improve it. To read more about how your
          data is used and how to opt out, see our{" "}
          <a
            className="underline underline-offset-2"
            href={PRIVACY_POLICY_URL}
            target="_blank"
            rel="noreferrer noopener"
          >
            privacy policy
          </a>
          .
        </p>
        <Button className="shrink-0 self-end" autoFocus disabled={!checked} onClick={onContinue}>
          Continue
          <ArrowRightIcon className="size-3.5" />
        </Button>
      </div>
    </>
  );
}

export function SimAiosStep({
  goals,
  onContinue,
  onLeave,
}: {
  readonly goals: readonly string[];
  readonly onContinue: () => void;
  readonly onLeave: (where: string) => void;
}) {
  const [mode, setMode] = useState<"run" | "prompt">("run");
  const [folder, setFolder] = useState(DEFAULT_AIOS_FOLDER);
  const [copied, setCopied] = useState(false);
  const [commandCopied, setCommandCopied] = useState(false);
  const prompt = buildAiosSetupPrompt(goals);
  // Same one-line command the real step shows, built from the same folder value.
  const folderCommand = buildAiosFoldersCommand(folder.trim() || DEFAULT_AIOS_FOLDER);
  return (
    <>
      <h1 className={H1}>Give your AI a memory</h1>
      <p className={LEDE}>
        This step is optional. Your AI starts every chat knowing who you are and what you work on.
        It reads a few plain text files first (an “AIOS”). Leonidas can build them with you.
      </p>
      <ScrollArea scrollFade className={SCROLL}>
        <div className="space-y-4 pr-3">
          <ul className="space-y-1.5">
            {AIOS_PRESET.map((entry) => (
              <li key={entry.path} className="flex items-baseline gap-3">
                <span className="w-24 shrink-0 font-mono text-xs">{entry.path}</span>
                <span className="text-xs text-muted-foreground">{entry.purpose}</span>
              </li>
            ))}
          </ul>
          {mode === "prompt" ? (
            <div className="space-y-2">
              <pre className="max-h-56 overflow-auto rounded-md border bg-muted/40 p-3 font-mono text-xs leading-relaxed whitespace-pre-wrap">
                {prompt}
              </pre>
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs text-muted-foreground">
                  Paste this message into the AI you already use.
                </p>
                <Button size="compact" variant="outline" onClick={() => setCopied(true)}>
                  {copied ? <CheckIcon /> : <CopyIcon />}
                  {copied ? "Copied" : "Copy"}
                </Button>
              </div>
            </div>
          ) : null}
          {mode === "run" ? (
            <div className="space-y-2">
              <label className="block space-y-1.5">
                <span className="text-xs text-muted-foreground">
                  AIOS folder (Leonidas creates it if missing)
                </span>
                <Input value={folder} onChange={(event) => setFolder(event.target.value)} />
              </label>
              <div className="flex items-center gap-3">
                <Button
                  onClick={() =>
                    onLeave("Started the “Set up my AI memory” chat (leaves the wizard)")
                  }
                >
                  Start the setup chat
                </Button>
                <p className="text-xs text-muted-foreground">Your AI builds the folder with you.</p>
              </div>
            </div>
          ) : null}
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">
              Do you not want a chat? Paste this into PowerShell to create the same folders.
            </p>
            <div className="flex items-start justify-between gap-3">
              <pre className="min-w-0 flex-1 overflow-auto rounded-md border bg-muted/40 p-3 font-mono text-xs leading-relaxed whitespace-pre-wrap break-all">
                {folderCommand}
              </pre>
              <Button size="compact" variant="outline" onClick={() => setCommandCopied(true)}>
                {commandCopied ? <CheckIcon /> : <CopyIcon />}
                {commandCopied ? "Copied" : "Copy"}
              </Button>
            </div>
          </div>
          <Button
            size="xs"
            variant="ghost-muted"
            onClick={() => setMode(mode === "run" ? "prompt" : "run")}
          >
            {mode === "run" ? "Copy the setup message for another AI" : "Go back to the setup chat"}
          </Button>
        </div>
      </ScrollArea>
      <div className="mt-6 flex justify-end">
        <Button variant="ghost" onClick={onContinue}>
          Skip for now
        </Button>
      </div>
    </>
  );
}

export function SimSkillsStep({
  goals,
  onBack,
  onContinue,
}: {
  readonly goals: readonly string[];
  readonly onBack: () => void;
  readonly onContinue: () => void;
}) {
  const skills = suggestSkills(goals);
  const [unchecked, setUnchecked] = useState<ReadonlySet<string>>(new Set());
  const [folder, setFolder] = useState(DEFAULT_AIOS_FOLDER);
  const selected = skills.filter((skill) => !unchecked.has(skill.name));
  return (
    <>
      <h1 className={H1}>Add skills for what you build</h1>
      <p className={LEDE}>
        You get a starter set, plus skills that match the goals you picked. Leonidas saves them in
        your AIOS folder. Your AI loads them in every chat.
      </p>
      <ScrollArea scrollFade className={SCROLL}>
        <div className="space-y-4 pr-3">
          {skills.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Pick goals on the first step to see matching skills.
            </p>
          ) : (
            <ul className="space-y-2.5">
              {skills.map((skill) => (
                <li key={skill.name}>
                  <label className="flex items-start gap-3">
                    <Checkbox
                      checked={!unchecked.has(skill.name)}
                      onCheckedChange={(checked) =>
                        setUnchecked((current) => {
                          const next = new Set(current);
                          if (checked) next.delete(skill.name);
                          else next.add(skill.name);
                          return next;
                        })
                      }
                    />
                    <span className="min-w-0 space-y-0.5">
                      <span className="block font-mono text-xs">{skill.name}</span>
                      <span className="block text-xs text-muted-foreground">
                        {skill.description}
                      </span>
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          )}
          <label className="block space-y-1.5">
            <span className="text-xs font-medium">AIOS folder</span>
            <Input value={folder} onChange={(event) => setFolder(event.target.value)} />
            <span className="block text-xs text-muted-foreground">
              Leonidas creates the folder if it is missing.
            </span>
          </label>
        </div>
      </ScrollArea>
      <div className="mt-6 flex items-center justify-between gap-2">
        <Button variant="ghost-muted" onClick={onBack}>
          Back
        </Button>
        <div className="flex gap-2">
          {selected.length > 0 ? (
            <Button variant="ghost" onClick={onContinue}>
              Skip
            </Button>
          ) : null}
          <Button autoFocus onClick={onContinue}>
            {selected.length > 0
              ? `Install ${selected.length} ${selected.length === 1 ? "skill" : "skills"} and continue`
              : "Continue"}
            <ArrowRightIcon className="size-3.5" />
          </Button>
        </div>
      </div>
    </>
  );
}

const SAMPLE_PROJECTS = [
  { path: "C:/Users/you/code/acme-site", threads: 14, age: "2d" },
  { path: "C:/Users/you/code/invoice-bot", threads: 6, age: "5d" },
  { path: "C:/Users/you/code/dotfiles", threads: 2, age: "3w" },
  { path: "C:/Users/you/old/experiments", threads: 31, age: "4mo" },
] as const;

export function SimImportStep({
  persona,
  onDone,
}: {
  readonly persona: SimPersona;
  readonly onDone: () => void;
}) {
  const [scanning, setScanning] = useState(true);
  const [importing, setImporting] = useState(false);
  const [selected, setSelected] = useState<ReadonlySet<string>>(
    new Set(persona === "veteran" ? SAMPLE_PROJECTS.slice(0, 2).map((p) => p.path) : []),
  );
  const projects = persona === "veteran" ? SAMPLE_PROJECTS : [];
  useEffect(() => {
    const timer = window.setTimeout(() => setScanning(false), 1200);
    return () => window.clearTimeout(timer);
  }, []);
  // Nothing to pick on a computer without Claude Code or Codex history, so move on.
  useEffect(() => {
    if (!scanning && projects.length === 0) onDone();
  }, [scanning, projects.length, onDone]);
  useEffect(() => {
    if (!importing) return;
    const timer = window.setTimeout(onDone, 1000);
    return () => window.clearTimeout(timer);
  }, [importing, onDone]);

  if (scanning) {
    return (
      <div className="flex h-full min-h-40 flex-col">
        <h1 className={H1}>Your projects</h1>
        <div className="flex flex-1 flex-col items-center justify-center gap-3 py-6">
          <Spinner size="lg" tone="muted" />
          <p className="text-center text-sm text-muted-foreground">
            Looking for projects from Claude Code and Codex…
          </p>
        </div>
        <div className="flex justify-end">
          <Button variant="ghost-muted" onClick={onDone}>
            Skip importing projects
          </Button>
        </div>
      </div>
    );
  }
  return (
    <>
      <h1 className={H1}>Import your projects</h1>
      <p className={LEDE}>
        Import projects and chats from Claude Code and Codex on your selected computers.
      </p>
      {projects.length > 0 ? (
        <div className="mt-5 flex items-center justify-between gap-3 text-xs text-muted-foreground">
          <span role="status">
            {selected.size} of {projects.length} selected
          </span>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="xs"
              disabled={selected.size === projects.length}
              onClick={() => setSelected(new Set(projects.map((p) => p.path)))}
            >
              Select all
            </Button>
            <Button
              variant="ghost"
              size="xs"
              disabled={selected.size === 0}
              onClick={() => setSelected(new Set())}
            >
              Select none
            </Button>
          </div>
        </div>
      ) : (
        <p className="mt-5 py-2 text-sm text-muted-foreground">
          No Claude Code or Codex projects found. Select "Skip importing projects" to continue.
        </p>
      )}
      <div className="mt-2 space-y-0.5">
        {projects.map((project) => (
          <label
            key={project.path}
            className="flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 hover:bg-muted/40"
          >
            <Checkbox
              checked={selected.has(project.path)}
              onCheckedChange={(checked) =>
                setSelected((current) => {
                  const next = new Set(current);
                  if (checked) next.add(project.path);
                  else next.delete(project.path);
                  return next;
                })
              }
            />
            <span className="min-w-0 flex-1 truncate font-mono text-xs">{project.path}</span>
            <span className="text-xs text-muted-foreground tabular-nums">
              {project.threads} · {project.age}
            </span>
          </label>
        ))}
      </div>
      <div className="mt-6 flex flex-wrap items-center justify-end gap-3">
        <Button variant="ghost-muted" disabled={importing} onClick={onDone}>
          Skip importing projects
        </Button>
        <Button
          autoFocus
          disabled={importing || selected.size === 0}
          onClick={() => setImporting(true)}
        >
          {importing
            ? "Importing…"
            : `Import ${selected.size} ${selected.size === 1 ? "project" : "projects"}`}
        </Button>
      </div>
    </>
  );
}
