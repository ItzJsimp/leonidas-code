import { describe, expect, it } from "vite-plus/test";

import { nextIconsOnly } from "./toolbarLabels";

describe("nextIconsOnly", () => {
  it("hides labels when they overflow and remembers the width they need", () => {
    expect(nextIconsOnly({ iconsOnly: false, needed: 0, content: 470, room: 435 })).toEqual({
      iconsOnly: true,
      needed: 470,
    });
  });

  it("keeps labels while they fit", () => {
    expect(nextIconsOnly({ iconsOnly: false, needed: 0, content: 426, room: 426 })).toEqual({
      iconsOnly: false,
      needed: 0,
    });
  });

  it("shows labels again only when the room holds the remembered width", () => {
    const hidden = { iconsOnly: true, needed: 470, content: 200 };
    expect(nextIconsOnly({ ...hidden, room: 469 }).iconsOnly).toBe(true);
    expect(nextIconsOnly({ ...hidden, room: 470 }).iconsOnly).toBe(false);
  });
});
