import { useLocation } from "@tanstack/react-router";
import { useEffect, useState, type ClipboardEvent, type KeyboardEvent } from "react";

import { APP_VERSION_LABEL } from "~/branding";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
} from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import { Spinner } from "~/components/ui/spinner";
import { Textarea } from "~/components/ui/textarea";
import { toastManager } from "~/components/ui/toast";
import { Toggle, ToggleGroup } from "~/components/ui/toggle-group";
import {
  buildFeedbackReport,
  FEEDBACK_TYPES,
  guessFeedbackType,
  MAX_FEEDBACK_CHARS,
  MAX_SCREENSHOT_CHARS,
  type FeedbackType,
} from "./feedback.logic";
import { getInstallId, getSavedName, saveName, submitFeedback } from "./feedbackRelay";
import {
  getFeedbackActiveModel,
  getFeedbackLastError,
  installFeedbackErrorCapture,
} from "./feedbackContext";
import { useFeedbackContextMenu } from "./feedbackContextMenu";
import { closeFeedback, useFeedbackStore } from "./feedbackStore";

/** Mounted once at the app root so every entry point shares one feedback box. */
export function FeedbackDialogHost() {
  const request = useFeedbackStore((state) => state.request);
  useFeedbackContextMenu();
  useEffect(installFeedbackErrorCapture, []);
  return (
    <Dialog open={request !== null} onOpenChange={(open) => (open ? undefined : closeFeedback())}>
      <DialogPopup>
        {request ? (
          <FeedbackForm
            source={request.source ?? "unknown"}
            initialText={request.initialText ?? ""}
            initialType={request.type ?? null}
          />
        ) : null}
      </DialogPopup>
    </Dialog>
  );
}

function readImageAsDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

/** One field, one key: type, hit Enter. The kind of report is guessed; tap a chip to change it. */
function FeedbackForm(props: {
  readonly source: string;
  readonly initialText: string;
  readonly initialType: FeedbackType | null;
}) {
  const pathname = useLocation({ select: (location) => location.pathname });
  const [text, setText] = useState(props.initialText);
  const [pickedType, setPickedType] = useState<FeedbackType | null>(props.initialType);
  const [name, setName] = useState(getSavedName);
  const [screenshot, setScreenshot] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const type = pickedType ?? guessFeedbackType(text);
  const canSend = text.trim().length > 0 && !busy;

  const send = async () => {
    if (!canSend) return;
    setBusy(true);
    setError(null);
    saveName(name);
    const activeModel = getFeedbackActiveModel();
    const result = await submitFeedback(
      buildFeedbackReport({
        installId: getInstallId(),
        name,
        type,
        text,
        screenshot,
        source: props.source,
        appVersion: APP_VERSION_LABEL,
        platform: navigator.platform || "unknown",
        route: pathname,
        now: new Date(),
        provider: activeModel?.provider ?? null,
        model: activeModel?.model ?? null,
        lastError: getFeedbackLastError(),
      }),
    );
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    closeFeedback();
    toastManager.add({
      type: "success",
      title: "Sent, thanks",
      description: "Jake and Mob will see it. You'll hear when it's fixed.",
    });
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing) return;
    event.preventDefault();
    void send();
  };

  const onPaste = (event: ClipboardEvent<HTMLTextAreaElement>) => {
    const image = [...event.clipboardData.items].find((item) => item.type.startsWith("image/"));
    const file = image?.getAsFile();
    if (!file) return;
    event.preventDefault();
    void readImageAsDataUrl(file).then((dataUrl) => {
      if (dataUrl.length > MAX_SCREENSHOT_CHARS) {
        setError("That screenshot is too large. Try a smaller crop.");
        return;
      }
      setError(null);
      setScreenshot(dataUrl);
    });
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>Send feedback</DialogTitle>
        <DialogDescription>
          Something broken, an idea, or a way to make this better. Just write it.
        </DialogDescription>
      </DialogHeader>
      <DialogPanel className="space-y-3">
        <ToggleGroup
          aria-label="Kind of feedback"
          variant="segmented"
          value={[type]}
          onValueChange={(next) => {
            const value = FEEDBACK_TYPES.find((option) => option.id === next[0]);
            if (value) setPickedType(value.id);
          }}
        >
          {FEEDBACK_TYPES.map((option) => (
            <Toggle key={option.id} value={option.id}>
              {option.label}
            </Toggle>
          ))}
        </ToggleGroup>
        <Textarea
          autoFocus
          onFocus={(event) => event.currentTarget.setSelectionRange(0, 0)}
          aria-label="Feedback"
          placeholder="What happened, or what would make this better? Paste a screenshot if it helps."
          rows={5}
          maxLength={MAX_FEEDBACK_CHARS}
          value={text}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={onKeyDown}
          onPaste={onPaste}
        />
        {screenshot ? (
          <div className="flex items-center gap-2">
            <img alt="Pasted screenshot" className="h-14 rounded border" src={screenshot} />
            <Button size="compact" variant="ghost-muted" onClick={() => setScreenshot(null)}>
              Remove
            </Button>
          </div>
        ) : null}
        <Input
          aria-label="Your name (optional)"
          placeholder="Your name (optional)"
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
        {error ? <p className="text-destructive text-xs">{error}</p> : null}
      </DialogPanel>
      <DialogFooter>
        <span className="mr-auto text-muted-foreground text-xs">
          Sends version, system, screen, model and recent errors. Never chats.
        </span>
        <Button disabled={!canSend} onClick={() => void send()}>
          {busy ? <Spinner /> : null}
          Send
        </Button>
      </DialogFooter>
    </>
  );
}
