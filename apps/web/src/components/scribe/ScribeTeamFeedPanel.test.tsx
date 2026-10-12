import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vite-plus/test";
import { ScribeTeamFeedPanel } from "./ScribeTeamFeedPanel";

describe("ScribeTeamFeedPanel", () => {
  it("renders trigger button with Scribe Team Feed label and icon", () => {
    const markup = renderToStaticMarkup(<ScribeTeamFeedPanel />);
    expect(markup).toContain("Team Feed");
    expect(markup).toContain("aria-label=\"Scribe Team Feed\"");
  });
});
