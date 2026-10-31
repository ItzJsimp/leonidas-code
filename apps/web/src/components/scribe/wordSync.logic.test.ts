import { describe, expect, it } from "vite-plus/test";

import { wordSyncDirError, wordSyncDirOf } from "./wordSync.logic";

describe("wordSyncDirOf", () => {
  it("reads a trimmed folder and treats anything else as off", () => {
    expect(wordSyncDirOf({ wordSyncDir: "  D:\\AIOS\\scribe\\words " })).toBe(
      "D:\\AIOS\\scribe\\words",
    );
    expect(wordSyncDirOf({ wordSyncDir: 5 })).toBe("");
    expect(wordSyncDirOf({})).toBe("");
  });
});

describe("wordSyncDirError", () => {
  it("accepts a full path, or blank to turn sync off", () => {
    expect(wordSyncDirError("D:\\Leonidas AIOS\\scribe\\words")).toBeNull();
    expect(wordSyncDirError("C:/aios/scribe")).toBeNull();
    expect(wordSyncDirError("\\\\pc\\share\\words")).toBeNull();
    expect(wordSyncDirError("/home/jake/aios/words")).toBeNull();
    expect(wordSyncDirError("   ")).toBeNull();
  });

  it("asks for the full path when the input is relative", () => {
    expect(wordSyncDirError("scribe\\words")).toMatch(/full path/);
    expect(wordSyncDirError("..\\words")).toMatch(/full path/);
  });
});
