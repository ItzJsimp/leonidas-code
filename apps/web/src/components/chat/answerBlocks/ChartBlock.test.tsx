import { act } from "react";
import { create, type ReactTestRenderer } from "react-test-renderer";
import { describe, expect, it } from "vite-plus/test";

import { AnswerBlockView } from "./AnswerBlockView";

function render(code: string): ReactTestRenderer {
  let renderer!: ReactTestRenderer;
  act(() => {
    renderer = create(
      <AnswerBlockView type="chart" code={code} closed fallback={<pre>raw</pre>} />,
    );
  });
  return renderer;
}

describe("ChartBlock", () => {
  it("draws one bar per value", () => {
    const renderer = render('{"kind":"bar","labels":["a","b","c"],"values":[1,2,3]}');
    expect(renderer.root.findAllByType("rect")).toHaveLength(3);
  });

  it("draws a line through every point", () => {
    const renderer = render('{"kind":"line","labels":["a","b"],"values":[1,5]}');
    expect(renderer.root.findByType("polyline").props.points.split(" ")).toHaveLength(2);
  });

  it("draws donut slices that add up to the whole ring", () => {
    const renderer = render('{"kind":"donut","title":"Spend","labels":["a","b"],"values":[1,3]}');
    const shares = renderer.root
      .findAllByType("circle")
      .map((circle) => Number(String(circle.props.strokeDasharray).split(" ")[0]));
    expect(shares).toEqual([25, 75]);
    expect(renderer.root.findByType("figure").props["aria-label"]).toBe("Spend. a: 1, b: 3");
  });

  it("shows a note when there is no data", () => {
    const renderer = render('{"kind":"bar","labels":[],"values":[]}');
    expect(JSON.stringify(renderer.toJSON())).toContain("No data to chart.");
  });
});
