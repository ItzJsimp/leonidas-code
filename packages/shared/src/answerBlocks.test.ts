import { describe, expect, it } from "vite-plus/test";

import { answerBlockType, parseAnswerBlock } from "./answerBlocks.ts";

describe("answerBlockType", () => {
  it("reads the block type from a fence language", () => {
    expect(answerBlockType("leo:table")).toBe("table");
    expect(answerBlockType("leo:chart")).toBe("chart");
    expect(answerBlockType("ts")).toBeNull();
    expect(answerBlockType("leo:map")).toBeNull();
  });
});

describe("parseAnswerBlock", () => {
  it("parses a table with KPIs", () => {
    const result = parseAnswerBlock(
      "table",
      '{"kpis":[["Models","5"]],"cols":["A","B"],"rows":[["x",1],["y",2]]}',
      true,
    );
    expect(result).toEqual({
      status: "block",
      block: {
        type: "table",
        kpis: [["Models", "5"]],
        cols: ["A", "B"],
        rows: [
          ["x", 1],
          ["y", 2],
        ],
      },
    });
  });

  it("parses choices given as strings or objects", () => {
    const result = parseAnswerBlock(
      "choices",
      '{"q":"Pick","options":["A",{"label":"B","note":"why"}]}',
      true,
    );
    expect(result).toEqual({
      status: "block",
      block: {
        type: "choices",
        q: "Pick",
        options: [{ label: "A" }, { label: "B", note: "why" }],
      },
    });
  });

  it("parses a checklist and a chart", () => {
    expect(parseAnswerBlock("checklist", '{"items":["one","two"]}', true)).toEqual({
      status: "block",
      block: { type: "checklist", items: ["one", "two"] },
    });
    expect(
      parseAnswerBlock("chart", '{"kind":"donut","labels":["a","b"],"values":[1,2]}', true),
    ).toEqual({
      status: "block",
      block: { type: "chart", kind: "donut", labels: ["a", "b"], values: [1, 2] },
    });
  });

  it("returns pending while an unclosed fence streams", () => {
    expect(parseAnswerBlock("table", '{"cols":["A"', false)).toEqual({ status: "pending" });
  });

  it("returns fallback for bad JSON or a bad shape in a closed fence", () => {
    expect(parseAnswerBlock("table", "{nope", true)).toEqual({ status: "fallback" });
    expect(parseAnswerBlock("table", '{"cols":"A","rows":[]}', true)).toEqual({
      status: "fallback",
    });
    expect(parseAnswerBlock("chart", '{"kind":"pie","labels":[],"values":[]}', true)).toEqual({
      status: "fallback",
    });
    expect(parseAnswerBlock("chart", '{"kind":"bar","labels":["a"],"values":[1,2]}', true)).toEqual(
      { status: "fallback" },
    );
    expect(parseAnswerBlock("choices", '{"options":[]}', true)).toEqual({ status: "fallback" });
  });
});

describe("parseAnswerBlock aliases (shapes models guess)", () => {
  it("accepts columns, KPI objects and option descriptions", () => {
    expect(
      parseAnswerBlock(
        "table",
        '{"columns":["A"],"rows":[["x"]],"kpis":[{"label":"Best","value":"x"}]}',
        true,
      ),
    ).toEqual({
      status: "block",
      block: { type: "table", kpis: [["Best", "x"]], cols: ["A"], rows: [["x"]] },
    });
    expect(
      parseAnswerBlock(
        "choices",
        '{"title":"Pick","options":[{"label":"A","value":"a","description":"why"}]}',
        true,
      ),
    ).toEqual({
      status: "block",
      block: { type: "choices", q: "Pick", options: [{ label: "A", note: "why" }] },
    });
  });

  it("accepts checklist item objects", () => {
    expect(
      parseAnswerBlock(
        "checklist",
        '{"items":[{"text":"one","checked":false},{"label":"two"}]}',
        true,
      ),
    ).toEqual({ status: "block", block: { type: "checklist", items: ["one", "two"] } });
  });

  it("accepts a chart given as data rows with xKey and yKey", () => {
    expect(
      parseAnswerBlock(
        "chart",
        '{"type":"bar","data":[{"runner":"Jest","speed":1},{"runner":"Bun","speed":3}],"xKey":"runner","yKey":"speed"}',
        true,
      ),
    ).toEqual({
      status: "block",
      block: { type: "chart", kind: "bar", labels: ["Jest", "Bun"], values: [1, 3] },
    });
    expect(
      parseAnswerBlock("chart", '{"kind":"line","data":[{"label":"a","value":2}]}', true),
    ).toEqual({
      status: "block",
      block: { type: "chart", kind: "line", labels: ["a"], values: [2] },
    });
  });
});
