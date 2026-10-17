import { describe, expect, it } from "vite-plus/test";

import { hintFor, parseAdvisorOutput } from "./modelAdvisor.ts";

const GB = 1024 ** 3;
const MB = 1024 ** 2;

describe("parseAdvisorOutput", () => {
  it("sorts by size, drops small and own programs, and adds hints", () => {
    const items = parseAdvisorOutput(
      [
        `vram|ComfyUI|${2 * GB}|1`,
        `vram|Roblox Studio|${3 * GB}|1`,
        `vram|tiny|${10 * MB}|1`,
        `vram|ollama_llama_server|${8 * GB}|1`,
        `ram|chrome|${4 * GB}|31`,
        `ram|small|${100 * MB}|2`,
        "garbage line",
        `ram|bad|notanumber|1`,
      ].join("\r\n"),
    );
    expect(items.map((item) => `${item.kind}:${item.name}`)).toEqual([
      "vram:Roblox Studio",
      "vram:ComfyUI",
      "ram:chrome",
    ]);
    expect(items[0]?.hint).toMatch(/Roblox/);
    expect(items[2]?.processes).toBe(31);
  });

  it("keeps at most five items per kind", () => {
    const lines = Array.from({ length: 9 }, (_, index) => `ram|app${index}|${(index + 1) * GB}|1`);
    const items = parseAdvisorOutput(lines.join("\n"));
    expect(items).toHaveLength(5);
    expect(items[0]?.name).toBe("app8");
  });

  it("gives no hint for an unknown program", () => {
    expect(hintFor("someunknownapp")).toBeNull();
  });
});
