import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vite-plus/test";
import { ScribeTeamFeedPanel } from "./ScribeTeamFeedPanel";

describe("ScribeTeamFeedPanel", () => {
  it("renders trigger button with Team dictations label and icon", () => {
    const markup = renderToStaticMarkup(<ScribeTeamFeedPanel />);
    expect(markup).toContain("Team dictations");
    expect(markup).toContain('aria-label="Team dictations"');
  });
});
