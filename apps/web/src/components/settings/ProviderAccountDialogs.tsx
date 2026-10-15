import type { EnvironmentId, ServerProvider } from "@t3tools/contracts";
import { ProviderDriverKind } from "@t3tools/contracts";
import { ChevronRightIcon } from "lucide-react";
import { useState } from "react";

import { ClaudeSignInCard } from "../onboarding/ClaudeSignInCard";
import { ProviderInstanceIcon } from "../chat/ProviderInstanceIcon";
import { Button } from "../ui/button";
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
} from "../ui/dialog";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Tooltip, TooltipPopup, TooltipTrigger } from "../ui/tooltip";
import { CONNECT_CHOICES, type ConnectChoice } from "./ConnectAccountDialog.logic";

const noop = () => {};

/** One text field in a small dialog: used for Rename and for API keys. */
export function TextValueDialog({
  title,
  description,
  label,
  initialValue,
  secret = false,
  submitLabel,
  onSave,
  onClose,
}: {
  readonly title: string;
  readonly description: string;
  readonly label: string;
  readonly initialValue: string;
  readonly secret?: boolean;
  readonly submitLabel: string;
  readonly onSave: (value: string) => void;
  readonly onClose: () => void;
}) {
  const [value, setValue] = useState(initialValue);
  const trimmed = value.trim();
  const save = () => {
    if (!trimmed) return;
    onSave(trimmed);
    onClose();
  };
  return (
    <Dialog open onOpenChange={(open) => (open ? undefined : onClose())}>
      <DialogPopup className="max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogPanel>
          <form
            className="grid gap-1.5"
            onSubmit={(event) => {
              event.preventDefault();
              save();
            }}
          >
            <Label htmlFor="account-text-value">{label}</Label>
            <Input
              id="account-text-value"
              type={secret ? "password" : "text"}
              autoComplete="off"
              spellCheck={false}
              value={value}
              onChange={(event) => setValue(event.target.value)}
              autoFocus
            />
          </form>
        </DialogPanel>
        <DialogFooter variant="bare">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} disabled={!trimmed}>
            {submitLabel}
          </Button>
        </DialogFooter>
      </DialogPopup>
    </Dialog>
  );
}

/** Install (when missing) and sign in to one Claude account, without leaving the page. */
export function ClaudeSignInDialog({
  environmentId,
  provider,
  onClose,
}: {
  readonly environmentId: EnvironmentId;
  readonly provider: ServerProvider;
  readonly onClose: () => void;
}) {
  const signedIn = provider.auth.status === "authenticated";
  return (
    <Dialog open onOpenChange={(open) => (open ? undefined : onClose())}>
      <DialogPopup className="max-w-md">
        <DialogHeader>
          <DialogTitle>{signedIn ? "Connected" : "Connect Claude"}</DialogTitle>
          <DialogDescription>
            {signedIn
              ? `${provider.displayName || "Claude"} is ready. Its usage now shows on this page.`
              : "Use the Claude plan you already pay for. Nothing to set up by hand."}
          </DialogDescription>
        </DialogHeader>
        <DialogPanel>
          {signedIn ? null : (
            <ClaudeSignInCard
              environmentId={environmentId}
              provider={provider}
              displayName={provider.displayName || "Claude"}
              autoStart
              onAutoStartConsumed={noop}
              terminalOpen={false}
              terminalAvailable={false}
              onOpenTerminal={noop}
            />
          )}
        </DialogPanel>
        <DialogFooter variant="bare">
          <Button variant={signedIn ? "default" : "outline"} onClick={onClose}>
            {signedIn ? "Done" : "Close"}
          </Button>
        </DialogFooter>
      </DialogPopup>
    </Dialog>
  );
}

/** The three services most people pay for, plus a way to every other service. */
export function ConnectTiles({
  disabled,
  onConnect,
  onMore,
}: {
  readonly disabled: boolean;
  readonly onConnect: (choice: ConnectChoice) => void;
  readonly onMore: () => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-2 @min-[34rem]/providers:grid-cols-[repeat(3,minmax(0,1fr))_auto]">
      {CONNECT_CHOICES.map((choice) => (
        <Tooltip key={choice.id}>
          <TooltipTrigger
            render={
              <button
                type="button"
                disabled={disabled}
                onClick={() => onConnect(choice.id)}
                className="flex min-h-14 cursor-pointer items-center gap-3 rounded-lg border border-border bg-card px-3 py-2.5 text-left transition-colors outline-none hover:bg-muted/30 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset disabled:cursor-default disabled:opacity-60"
              />
            }
          >
            <ProviderInstanceIcon
              driverKind={ProviderDriverKind.make(choice.driver)}
              displayName={choice.title}
              iconClassName="size-5"
            />
            <span className="min-w-0">
              <span className="block text-sm font-medium text-foreground">{choice.title}</span>
              <span className="block text-xs text-muted-foreground">{choice.plans}</span>
            </span>
          </TooltipTrigger>
          <TooltipPopup side="top">
            Connect a {choice.title} account. You sign in once in your browser.
          </TooltipPopup>
        </Tooltip>
      ))}
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              variant="ghost-muted"
              size="sm"
              className="justify-self-start @min-[34rem]/providers:self-center"
              disabled={disabled}
              onClick={onMore}
            />
          }
        >
          More services
          <ChevronRightIcon />
        </TooltipTrigger>
        <TooltipPopup side="top">
          OpenRouter, Cursor, Grok and other services, with all settings.
        </TooltipPopup>
      </Tooltip>
    </div>
  );
}
