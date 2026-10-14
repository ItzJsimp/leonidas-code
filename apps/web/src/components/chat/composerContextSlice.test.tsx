import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { afterEach, expect, it, vi } from "vite-plus/test";

import { useComposerContextSlice, type ComposerContextSlice } from "./composerContextSlice";

let renderer: ReactTestRenderer;
afterEach(async () => {
  if (renderer) await act(() => renderer.unmount());
  vi.unstubAllGlobals();
});

const base = {
  contextWindow: null,
  velocity: null,
  compactUnavailable: false,
  compactDisabledReason: null,
};

async function mount() {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const seen: ComposerContextSlice[] = [];
  function Probe(props: { onCompact: () => void; compactUnavailable?: boolean }) {
    seen.push(
      useComposerContextSlice({
        ...base,
        compactUnavailable: props.compactUnavailable ?? false,
        onCompact: props.onCompact,
      }),
    );
    return null;
  }
  await act(async () => {
    renderer = create(<Probe onCompact={() => {}} />);
  });
  const update = (props: { onCompact: () => void; compactUnavailable?: boolean }) =>
    act(async () => renderer.update(<Probe {...props} />));
  return { seen, update };
}

it("keeps the slice and onCompact stable when only the callback identity changes", async () => {
  const { seen, update } = await mount();
  await update({ onCompact: () => {} });
  await update({ onCompact: () => {} });
  expect(new Set(seen).size).toBe(1);
});

it("calls the latest onCompact through the stable callback", async () => {
  const { seen, update } = await mount();
  const latest = vi.fn();
  await update({ onCompact: latest });
  seen.at(-1)!.onCompact();
  expect(latest).toHaveBeenCalledTimes(1);
});

it("issues a new slice when a value changes", async () => {
  const { seen, update } = await mount();
  await update({ onCompact: () => {}, compactUnavailable: true });
  expect(seen.at(-1)).not.toBe(seen[0]);
  expect(seen.at(-1)!.compactUnavailable).toBe(true);
});
