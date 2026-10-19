// @vitest-environment jsdom
import { act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { EnvironmentId } from "@t3tools/contracts";
import { afterEach, beforeEach, expect, it, vi } from "vite-plus/test";

const mocks = vi.hoisted(() => ({ environmentId: null as string | null, speak: "" }));
vi.mock("~/state/environments", () => ({ usePrimaryEnvironmentId: () => mocks.environmentId }));
vi.mock("./ComposerVoiceButton", () => ({
  ComposerVoiceButton: ({ onText }: { onText: (text: string) => boolean }) => (
    <button type="button" aria-label="mic" onClick={() => onText(mocks.speak)} />
  ),
}));
import { DictationTextarea } from "./DictationTextarea";

let root: Root;
let container: HTMLDivElement;
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  mocks.environmentId = EnvironmentId.make("env-1");
  mocks.speak = "hello ";
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

function Controlled({ onChange }: { onChange: (value: string) => void }) {
  const [value, setValue] = useState("ab");
  return (
    <DictationTextarea
      aria-label="Note"
      value={value}
      maxLength={9}
      onChange={(event) => {
        setValue(event.target.value);
        onChange(event.target.value);
      }}
    />
  );
}

it("inserts dictated text at the cursor and fires onChange once", async () => {
  const onChange = vi.fn();
  await act(async () => root.render(<Controlled onChange={onChange} />));
  const field = container.querySelector("textarea")!;
  field.setSelectionRange(1, 1);
  await act(async () => container.querySelector<HTMLButtonElement>("[aria-label=mic]")!.click());
  expect(field.value).toBe("ahello b");
  expect(onChange).toHaveBeenCalledTimes(1);
  expect(onChange).toHaveBeenCalledWith("ahello b");
  expect(field.selectionStart).toBe(7);
});

it("keeps the field within maxLength", async () => {
  mocks.speak = "0123456789";
  await act(async () => root.render(<Controlled onChange={vi.fn()} />));
  await act(async () => container.querySelector<HTMLButtonElement>("[aria-label=mic]")!.click());
  expect(container.querySelector("textarea")!.value).toHaveLength(9);
});

it("shows no mic without a connected environment", async () => {
  mocks.environmentId = null;
  await act(async () => root.render(<Controlled onChange={vi.fn()} />));
  expect(container.querySelector("[aria-label=mic]")).toBeNull();
});
