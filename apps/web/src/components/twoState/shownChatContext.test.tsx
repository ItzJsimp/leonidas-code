import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vite-plus/test";

import { ShownChatContext, useRouteOrShownThreadRef } from "./shownChatContext";

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
