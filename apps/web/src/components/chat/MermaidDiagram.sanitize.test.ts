// @vitest-environment jsdom
import { describe, expect, it } from "vite-plus/test";

import { sanitizeDiagramSvg, sanitizeMathDiagramSvg } from "./MermaidDiagram";

function markup(fragment: Node) {
  const host = document.createElement("div");
  host.append(fragment);
  return host.innerHTML;
}

describe.each([
  ["diagram", sanitizeDiagramSvg],
  ["math diagram", sanitizeMathDiagramSvg],
])("%s sanitizer", (_name, sanitize) => {
  it("removes script, links, images and event handlers", () => {
    const html = markup(
      sanitize(
        `<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"><script>alert(1)</script>` +
          `<a href="https://example.test"><text>link</text></a>` +
          `<image href="https://example.test/x.png"/><rect width="5" height="5" onclick="x()"/></svg>`,
      ),
    );
    expect(html).not.toMatch(/script|onload|onclick|href|<image|<a[ >]/i);
    expect(html).toContain("<rect");
  });

  it("drops a style value that fetches a remote URL, even when it is escaped", () => {
    const html = markup(
      sanitize(
        `<svg xmlns="http://www.w3.org/2000/svg"><rect style="fill:url(https://example.test/a)"/>` +
          `<rect style="fill:u\\72l(https://example.test/b)"/></svg>`,
      ),
    );
    expect(html).not.toContain("example.test");
  });

  it("keeps a plain style value", () => {
    const html = markup(
      sanitize(`<svg xmlns="http://www.w3.org/2000/svg"><rect style="fill:red"/></svg>`),
    );
    expect(html).toMatch(/fill:\s*red/);
  });
});
