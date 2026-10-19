import { describe, expect, it } from "vite-plus/test";
import { aiLevelSettingsPatch } from "./aiLevelSync";

describe("aiLevelSettingsPatch", () => {
  it("copies the local level on first sync, or starts new today", () => {
    expect(
      aiLevelSettingsPatch(
        { aiLevel: "new", aiLevelSince: "" },
        { level: "builder", startedDay: "2026-09-01" },
        "2026-10-19",
      ),
    ).toEqual({ aiLevel: "builder", aiLevelSince: "2026-09-01" });
    expect(aiLevelSettingsPatch({ aiLevel: "new", aiLevelSince: "" }, null, "2026-10-19")).toEqual({
      aiLevel: "new",
      aiLevelSince: "2026-10-19",
    });
  });

  it("restarts the window when the user picks another level, and is quiet otherwise", () => {
    const server = { aiLevel: "new", aiLevelSince: "2026-09-01" } as const;
    expect(
      aiLevelSettingsPatch(server, { level: "builder", startedDay: "2026-09-01" }, "2026-10-19"),
    ).toEqual({ aiLevel: "builder", aiLevelSince: "2026-10-19" });
    expect(
      aiLevelSettingsPatch(server, { level: "new", startedDay: "2026-09-01" }, "2026-10-19"),
    ).toBeNull();
    expect(aiLevelSettingsPatch(server, null, "2026-10-19")).toBeNull();
  });
});
