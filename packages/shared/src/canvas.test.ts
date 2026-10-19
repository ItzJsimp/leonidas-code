import { describe, expect, it } from "vite-plus/test";
import { buildCanvasDocument } from "./canvas.ts";
describe("structured canvas", () => {
  it("keeps the largest decoded input within the HTML publication limit", () => {
    const quote = '"';
    const section = {
      title: quote.repeat(80),
      summary: quote.repeat(2000),
      metrics: Array.from({ length: 4 }, () => ({
        label: quote.repeat(80),
        value: quote.repeat(80),
      })),
      flow: Array.from({ length: 8 }, () => quote.repeat(40)),
      columns: Array.from({ length: 6 }, () => quote.repeat(80)),
      rows: Array.from({ length: 20 }, () => Array.from({ length: 6 }, () => quote.repeat(80))),
    };
    expect(
      buildCanvasDocument({
        title: quote.repeat(80),
        sections: Array.from({ length: 6 }, () => section),
      }).length,
    ).toBeLessThan(512000);
  });
  it("builds accessible tabs, metrics, SVG flow and tables with local theme tokens", () => {
    const html = buildCanvasDocument({
      title: "Architecture",
      sections: [
        {
          title: "Plan",
          summary: "Ready",
          metrics: [{ label: "Tests", value: "28" }],
          flow: ["Input", "Output"],
          columns: ["Step", "State"],
          rows: [["Build", "Done"]],
        },
        { title: "Review", summary: "Check it" },
      ],
    });
    expect(html).toContain('role="tablist"');
    expect(html).toContain('aria-controls="pane-1"');
    expect(html).toContain('role="tabpanel"');
    expect(html).toContain("<svg");
    expect(html).toContain("<table");
    expect(html).toContain("var(--foreground)");
    expect(html).toContain("ArrowRight");
    expect(html).not.toMatch(/https?:\/\//);
  });
  it("escapes all content, including script and attribute injection", () => {
    const html = buildCanvasDocument({
      title: "</title><script>alert(1)</script>",
      sections: [
        {
          title: '" onclick="alert(2)',
          summary: "<img src=x onerror=alert(3)>",
          metrics: [{ label: "<b>", value: "</div>" }],
          flow: ["<script>"],
          columns: ["<img>"],
          rows: [["<script>"]],
        },
      ],
    });
    expect(html).not.toContain("<script>alert");
    expect(html).not.toContain("<img");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("&quot; onclick=&quot;");
  });
});
