import { describe, expect, it } from "vite-plus/test";

import { railsMode, splitFits } from "./railsMode";

describe("splitFits", () => {
  it("keeps the split only when each half has room", () => {
    expect(splitFits(1152)).toBe(true);
    expect(splitFits(900)).toBe(true);
    expect(splitFits(728)).toBe(false);
    expect(splitFits(390)).toBe(false);
  });
});

describe("railsMode", () => {
  it("shows the rails when the chat keeps its width", () => {
    expect(railsMode({ fits: true, split: false, splitActive: false })).toBe("rails");
  });
  it("moves the rails into the drawer when the chat is narrow", () => {
    expect(railsMode({ fits: false, split: false, splitActive: false })).toBe("drawer");
  });
  it("hides the rails and the drawer while the Command Center split or a chat split is open", () => {
    expect(railsMode({ fits: true, split: true, splitActive: false })).toBe("none");
    expect(railsMode({ fits: false, split: true, splitActive: false })).toBe("none");
    expect(railsMode({ fits: false, split: false, splitActive: true })).toBe("none");
  });
});
