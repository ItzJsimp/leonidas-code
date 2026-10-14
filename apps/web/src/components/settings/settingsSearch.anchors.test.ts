import { describe, expect, it } from "vite-plus/test";

import { SETTINGS_SEARCH_ITEMS } from "./settingsSearch";

const sources = import.meta.glob<string>(["../../**/*.{ts,tsx}", "!../../**/*.test.*"], {
  query: "?raw",
  import: "default",
  eager: true,
});

// Rows generated from a command or host list build their anchor at render time.
const GENERATED_ANCHOR_PREFIXES = ["keybinding-", "source-control-host-"];

describe("settings search anchors", () => {
  it("renders every catalog result somewhere, by its id or its target anchor", () => {
    const text = Object.entries(sources)
      .filter(([path]) => !path.endsWith("/settingsSearch.ts"))
      .map(([, source]) => source)
      .join("\n");
    const dead = SETTINGS_SEARCH_ITEMS.filter((item) => {
      if (GENERATED_ANCHOR_PREFIXES.some((prefix) => item.id.startsWith(prefix))) return false;
      const anchor = "targetId" in item ? item.targetId : item.id;
      return !text.includes(`"${anchor}"`) && !text.includes(`\`${anchor}\``);
    }).map((item) => item.id);
    expect(dead).toEqual([]);
  });
});
