import { act } from "react";
import { create, type ReactTestRenderer } from "react-test-renderer";
import { describe, expect, it, vi } from "vite-plus/test";

import { AnswerBlockActionsContext } from "./AnswerBlockActions";
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

const CHOICES = '{"q":"Pick one","options":["Alpha",{"label":"Beta","note":"why"}]}';

function renderChoices(fillComposer?: (text: string) => void): ReactTestRenderer {
  let renderer!: ReactTestRenderer;
  const view = <AnswerBlockView type="choices" code={CHOICES} closed fallback={<pre>raw</pre>} />;
  act(() => {
    renderer = create(
      fillComposer ? (
        <AnswerBlockActionsContext value={{ fillComposer }}>{view}</AnswerBlockActionsContext>
      ) : (
        view
      ),
    );
  });
  return renderer;
}

describe("AnswerBlockView choices", () => {
  it("fills the composer with the picked label and never sends", () => {
    const fillComposer = vi.fn();
    const renderer = renderChoices(fillComposer);
    act(() => renderer.root.findAllByType("button")[1]!.props.onClick());
    expect(fillComposer).toHaveBeenCalledWith("Beta");
    expect(renderer.root.findAllByType("button")[1]!.props["aria-pressed"]).toBe(true);
  });

  it("lets the user pick again to change the choice", () => {
    const fillComposer = vi.fn();
    const renderer = renderChoices(fillComposer);
    act(() => renderer.root.findAllByType("button")[0]!.props.onClick());
    act(() => renderer.root.findAllByType("button")[1]!.props.onClick());
    expect(fillComposer.mock.calls).toEqual([["Alpha"], ["Beta"]]);
    expect(renderer.root.findAllByType("button").every((b) => !b.props.disabled)).toBe(true);
  });

  it("disables the cards when no composer can receive the choice", () => {
    const renderer = renderChoices();
    expect(renderer.root.findAllByType("button").every((button) => button.props.disabled)).toBe(
      true,
    );
  });
});

describe("AnswerBlockView checklist", () => {
  it("toggles items and counts the done items", () => {
    let renderer!: ReactTestRenderer;
    act(() => {
      renderer = create(
        <AnswerBlockView
          type="checklist"
          code='{"title":"Steps","items":["one","two"]}'
          closed
          fallback={<pre>raw</pre>}
        />,
      );
    });
    const boxes = () => renderer.root.findAllByType("input");
    act(() => boxes()[1]!.props.onChange());
    expect(boxes().map((box) => box.props.checked)).toEqual([false, true]);
    expect(JSON.stringify(renderer.toJSON())).toContain('"1","/","2"');
    act(() => boxes()[1]!.props.onChange());
    expect(boxes()[1]!.props.checked).toBe(false);
  });
});
