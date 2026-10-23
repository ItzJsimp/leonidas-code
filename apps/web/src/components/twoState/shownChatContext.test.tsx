// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vite-plus/test";

import {
  ShownChatContext,
  useRememberedThreadRef,
  useRouteOrShownThreadRef,
} from "./shownChatContext";
import { useTwoStateStore } from "./twoStateStore";

const shown = { environmentId: "env-1", threadId: "shown" } as never;
const fromUrl = { environmentId: "env-1", threadId: "url" } as never;

function Probe({ url }: { readonly url: never | null }) {
  return <i>{useRouteOrShownThreadRef(url)?.threadId ?? "none"}</i>;
}

describe("useRouteOrShownThreadRef", () => {
  it("uses the chat from the URL first", () => {
    const html = renderToStaticMarkup(
      <ShownChatContext value={shown}>
        <Probe url={fromUrl} />
      </ShownChatContext>,
    );
    expect(html).toContain("url");
  });

  it("uses the shown chat when the URL has none", () => {
    const html = renderToStaticMarkup(
      <ShownChatContext value={shown}>
        <Probe url={null} />
      </ShownChatContext>,
    );
    expect(html).toContain("shown");
  });

  it("is empty with no URL chat and no shown chat", () => {
    expect(renderToStaticMarkup(<Probe url={null} />)).toContain("none");
  });
});

describe("useRememberedThreadRef", () => {
  it("returns the remembered chat as a thread ref, else null", () => {
    function Remembered() {
      return <i>{useRememberedThreadRef()?.threadId ?? "none"}</i>;
    }
    const host = document.createElement("div");
    const root = createRoot(host);
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    act(() => root.render(<Remembered />));
    expect(host.textContent).toBe("none");
    act(() =>
      useTwoStateStore.getState().rememberThread({ environmentId: "env-1", threadId: "last" }),
    );
    expect(host.textContent).toBe("last");
    act(() => root.unmount());
  });
});
