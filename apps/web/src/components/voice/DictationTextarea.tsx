import { useRef } from "react";
import { usePrimaryEnvironmentId } from "~/state/environments";
import { Textarea, type TextareaProps } from "../ui/textarea";
import { ComposerVoiceButton } from "./ComposerVoiceButton";

const setTextareaValue = Object.getOwnPropertyDescriptor(
  HTMLTextAreaElement.prototype,
  "value",
)?.set;

/** A Textarea with a mic that dictates at the cursor. Works for controlled and uncontrolled fields. */
export function DictationTextarea(props: TextareaProps) {
  const environmentId = usePrimaryEnvironmentId();
  const box = useRef<HTMLDivElement>(null);
  const insert = (text: string) => {
    const field = box.current?.querySelector("textarea");
    if (!field || !setTextareaValue) return false;
    const { selectionStart: start, selectionEnd: end } = field;
    let next = field.value.slice(0, start) + text + field.value.slice(end);
    if (field.maxLength > 0) next = next.slice(0, field.maxLength);
    const caret = Math.min(start + text.length, next.length);
    setTextareaValue.call(field, next);
    field.dispatchEvent(new Event("input", { bubbles: true }));
    field.setSelectionRange(caret, caret);
    return true;
  };
  return (
    <div ref={box} className="relative w-full [&_textarea]:pr-10">
      <Textarea {...props} />
      {environmentId ? (
        <div className="absolute right-1 bottom-1">
          <ComposerVoiceButton
            environmentId={environmentId}
            disabled={props.disabled ?? false}
            onText={insert}
          />
        </div>
      ) : null}
    </div>
  );
}
