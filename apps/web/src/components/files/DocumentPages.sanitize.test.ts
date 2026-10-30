// @vitest-environment jsdom
import { describe, expect, it } from "vite-plus/test";

import { sanitizeDocumentHtml } from "./DocumentPages";

describe("sanitizeDocumentHtml", () => {
  it("removes script, frames, forms, links, styles and event handlers", () => {
    const html = sanitizeDocumentHtml(
      `<p onclick="x()" style="background:url(https://example.test/a)">text</p>` +
        `<script>alert(1)</script><iframe src="https://example.test"></iframe>` +
        `<form action="https://example.test"><input></form>` +
        `<a href="https://example.test">link</a><style>p{color:red}</style>`,
    );
    expect(html).toContain("text");
    expect(html).not.toMatch(
      /script|<iframe|<form|<input|<style|href|onclick|style=|example\.test/i,
    );
  });

  it("keeps tables and the whitespace marker that ODF documents need", () => {
    const html = sanitizeDocumentHtml(
      `<table><tr><td colspan="2">cell</td></tr></table><span data-odf-whitespace="1"> </span>`,
    );
    expect(html).toContain("<td");
    expect(html).toContain("colspan");
    expect(html).toContain("data-odf-whitespace");
  });
});
