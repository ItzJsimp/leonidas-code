import { act } from "react";
import { create, type ReactTestRenderer } from "react-test-renderer";
import { describe, expect, it } from "vite-plus/test";

import { AnswerBlockView } from "./AnswerBlockView";

const TABLE = '{"kpis":[["Models","3"]],"cols":["Name","Score"],"rows":[["b",2],["a",10],["c",1]]}';

function render(code: string, closed = true): ReactTestRenderer {
  let renderer!: ReactTestRenderer;
  act(() => {
    renderer = create(
      <AnswerBlockView type="table" code={code} closed={closed} fallback={<pre>raw</pre>} />,
    );
  });
  return renderer;
}

const firstColumn = (renderer: ReactTestRenderer) =>
  renderer.root
    .findAllByType("tr")
    .slice(1)
    .map((row) => row.findAllByType("td")[0]!.children[0]);

describe("AnswerBlockView table", () => {
  it("renders KPI tiles and rows", () => {
    const renderer = render(TABLE);
    expect(renderer.root.findAllByProps({ "data-answer-block": "table" })).toHaveLength(1);
    expect(JSON.stringify(renderer.toJSON())).toContain("Models");
    expect(firstColumn(renderer)).toEqual(["b", "a", "c"]);
  });

  it("sorts a column on click, then reverses it", () => {
    const renderer = render(TABLE);
    const scoreHeader = renderer.root.findAllByType("button")[1]!;
    act(() => scoreHeader.props.onClick());
    expect(firstColumn(renderer)).toEqual(["c", "b", "a"]);
    act(() => renderer.root.findAllByType("button")[1]!.props.onClick());
    expect(firstColumn(renderer)).toEqual(["a", "b", "c"]);
  });

  it("shows the fallback for bad JSON and a placeholder while streaming", () => {
    expect(JSON.stringify(render("{bad").toJSON())).toContain("raw");
    const pending = render('{"cols":["A"', false);
    expect(pending.root.findAllByProps({ "aria-label": "Loading block" })).toHaveLength(1);
  });
});
