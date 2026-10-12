import { CHAT_MARKDOWN_REHYPE_PLUGINS } from "@t3tools/shared/markdownPipeline";
import type { Root } from "mdast";
import { renderToStaticMarkup } from "react-dom/server";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Plugin } from "unified";
import { describe, expect, it } from "vite-plus/test";

import { remarkCodexDirectives } from "@t3tools/shared/codexMarkdownDirectives";
import { remarkGithubAlerts } from "@t3tools/shared/markdownGithubAlerts";
import { createIncrementalMarkdownPlugin } from "./markdown-incremental";
import { remarkNormalizeListItemIndentation } from "@t3tools/shared/markdownListIndentation";

function observeParsing(parsedSources?: string[]): Plugin<[], Root> {
  return function () {
    const original = this.parser;
    if (original) {
      this.parser = (text, file) => {
        parsedSources?.push(text);
        return original(text, file);
      };
    }
  };
}

/** Runs the parser and the plugins before it, then stops before any rendering. */
function parseOnly(source: string, incremental?: Plugin<[], Root>, parsedSources?: string[]) {
  const stopAfterParse: Plugin<[], Root> = () => () => {
    throw new Error("stop after parse");
  };
  expect(() =>
    renderToStaticMarkup(
      <ReactMarkdown
        remarkPlugins={[
          observeParsing(parsedSources),
          ...(incremental ? [incremental] : []),
          stopAfterParse,
        ]}
      >
        {source}
      </ReactMarkdown>,
    ),
  ).toThrow("stop after parse");
}

function render(source: string, incremental?: Plugin<[], Root>, parsedSources?: string[]) {
  let tree: Root | undefined;
  const capture: Plugin<[], Root> = () => (root) => {
    tree = structuredClone(root);
  };
  const html = renderToStaticMarkup(
    <ReactMarkdown
      remarkPlugins={[
        observeParsing(parsedSources),
        capture,
        remarkGfm,
        remarkGithubAlerts,
        remarkNormalizeListItemIndentation,
        remarkCodexDirectives,
        ...(incremental ? [incremental] : []),
      ]}
      rehypePlugins={CHAT_MARKDOWN_REHYPE_PLUGINS}
    >
      {source}
    </ReactMarkdown>,
  );
  return { html, tree };
}

const prefix = "# Before\n\n```ts\nconst values = [1, 2];\n```\n\n";

describe("incremental Markdown parsing", () => {
  it("keeps the document prefix cached when list recovery parses contain fences", () => {
    const source =
      prefix +
      "-       first block\n\n        ```ts\n        const nested = 1;\n        ```\n\n        tail";
    const incremental = createIncrementalMarkdownPlugin();
    const parsedSources: string[] = [];
    expect(render(source, incremental, parsedSources)).toEqual(render(source));
    parsedSources.length = 0;
    const next = source + " more";
    expect(render(next, incremental, parsedSources)).toEqual(render(next));
    expect(parsedSources).not.toContain(next);
    expect(parsedSources.some((text) => text.startsWith("t3-markdown-inline-prefix:"))).toBe(true);
  });

  it.each([
    "a\n===\n\nb\n---\n",
    "- first\n\n  continued\n\n- next\n",
    "> quoted\n>\n> ```js\n> abc\n> ```\n\nend",
    "<div>\nhello\n\n</div>\n\nend",
    "[ref]\n\n[ref]: /later",
    "a[^x]\n\n[^x]: note",
    "a | b\n--|--\na | b\n",
    "```\na\n```\n\nnext\n\n~~~\nb\n~~~\n\nmore",
    "\n\n\tcode\n\nmore",
    "text <https://example.com> *bold*",
    "> [!NOTE]\n> alert\n\n- [ ] task",
    "\uFEFFtext after a byte-order mark",
  ])("preserves the parse tree, positions, and HTML while streaming %j", (tail) => {
    const source = prefix + tail;
    const incremental = createIncrementalMarkdownPlugin();
    for (let end = 0; end <= source.length; end++) {
      const text = source.slice(0, end);
      expect(render(text, incremental), `prefix ${end}`).toEqual(render(text));
    }
  });

  it.each(["\r\n", "\r"])("preserves partial %j line endings", (newline) => {
    const source = (prefix + "next\n\n```\nlast\n```\n\nend").replaceAll("\n", newline);
    const incremental = createIncrementalMarkdownPlugin();
    for (let end = 0; end <= source.length; end++) {
      const text = source.slice(0, end);
      expect(render(text, incremental)).toEqual(render(text));
    }
  });

  it("updates earlier references when definitions arrive after the cached prefix", () => {
    const before = "[later] and footnote[^note]\n\n" + prefix;
    const incremental = createIncrementalMarkdownPlugin();
    for (const tail of ["text", "[later]: /target", "[later]: /target\n\n[^note]: a note"]) {
      expect(render(before + tail, incremental)).toEqual(render(before + tail));
    }
  });

  it("handles edits, replacements, and repeated renders without leaking transformed nodes", () => {
    const incremental = createIncrementalMarkdownPlugin();
    const documents = [
      prefix + "- first\n - second",
      prefix + "> [!NOTE]\n> transformed alert",
      prefix + "plain text",
      "replacement without fences",
      prefix.replace("Before", "Edited") + "edited prefix",
      prefix + "plain text",
      prefix + "plain text",
    ];
    for (const document of documents) {
      expect(render(document, incremental)).toEqual(render(document));
    }
  });

  it("does not freeze unclosed, nested, indented, or mismatched fences", () => {
    const prefixes = [
      "```\nopen\n\n",
      "````\n```\n\n",
      "> ```\n> code\n> ```\n\n",
      "- ```\n  code\n  ```\n\n",
      "    ```\n    code\n    ```\n\n",
      "<script>\n```\ncode\n```\n\n",
    ];
    for (const start of prefixes) {
      const incremental = createIncrementalMarkdownPlugin();
      for (const tail of ["", "text", "\n```\n", "\n```\n\nnext"]) {
        expect(render(start + tail, incremental)).toEqual(render(start + tail));
      }
    }
  });
});

const FENCE = "```";
const TILDE = "~~~";

const corpus = [
  "The first paragraph has plain words.\n\nThe second has *emphasis* and **strong** text.\n\nA third ends it.\n",
  "*This emphasis starts here\n\nand continues into the next paragraph* but the blank line stops it.\n\nAnother _line\n\nand more_ text.\n",
  "# Title\n\nIntro text under the title.\n\n## Section\n\nSome more text.\n\nSetext heading\n=============\n\nAfter setext.\n\n### Small\n\nEnd.",
  "- first item\n\n  continued paragraph in first item\n\n  - nested one\n  - nested two\n\n- second item\n\n- third item\n\nAfter the list.\n",
  `1. step one\n\n2. step two with a fence:\n\n   ${FENCE}bash\n   npm test\n   ${FENCE}\n\n3. step three\n\nClosing paragraph.\n`,
  "- alpha\n- beta\n- gamma\n\n## Next heading\n\nparagraph after heading\n",
  "- a\n\nb\n\n- c\n\n  d\n\ne",
  "| Name | Value |\n| :--- | ---: |\n| one | 1 |\n| two | 2 |\n\nTable above, prose below.\n\nAnother paragraph.\n",
  "x | y\n--|--\n1 | 2\n\n\nz | w\n-|-\n3 | 4\n\nend",
  "> quoted first line\n> still quoted\n>\n> second quoted paragraph\n\nunquoted text after\n",
  "> one\n\n> two\n\n> three\nlazy line\n\nfinal",
  `> ${FENCE}js\n> const a = 1;\n> ${FENCE}\n\nafter the quote\n\n> ${TILDE}\n> tilde\n> ${TILDE}\n`,
  `${TILDE}python\nprint("hi")\n${TILDE}\n\nprose between\n\n${TILDE}\nplain\n${TILDE}\n\nend`,
  `Intro\n\n${FENCE}ts\nconst x = 1;\n\nthis line is still code\n\n${FENCE}\n\nafter`,
  `${"````"}md\n${FENCE}\ninner\n${FENCE}\n${"````"}\n\nnext paragraph`,
  "Para before.\n\n    indented code line\n\n    second indented line\n\nparagraph after code\n",
  "Start.\n\n\tTab indented\n\n\tmore\n\nBack to text.",
  'A line with <span class="x">inline html</span> inside.\n\n<kbd>Ctrl</kbd> + <kbd>C</kbd> is a shortcut.\n\nDone.',
  "<div>\nblock html\n\nstill inside?\n</div>\n\nafter html block\n",
  "<!-- a comment\n\nspanning lines -->\n\nvisible text\n",
  "<script>\nvar a = 1;\n\nvar b = 2;\n</script>\n\nafter script\n",
  "Text with a note[^1] and another[^two].\n\nMore prose.\n\n[^1]: The first note.\n\n[^two]: Second note text.\n",
  "A reference[^late] first.\n\nThen prose.\n\nAnd more prose.\n\n[^late]: defined at the end",
  "See [the docs][docs] and [site].\n\nMore text here.\n\n[docs]: https://example.com/docs\n[site]: https://example.com\n",
  "Uses [later] before the definition.\n\nParagraph two.\n\n[later]: /later-page\n\nLast paragraph.",
  "Inline $x^2 + y^2$ math text.\n\n$$\nE = mc^2\n$$\n\nAfter math.\n",
  "Before rule\n\n---\n\nBetween rules\n\n***\n\n* * *\n\nAfter rules\n",
  "Heading one\n===\n\nparagraph a\n\nHeading two\n---\n\nparagraph b\n",
  "Open [the shot](C:\\Users\\me\\shot.png) now.\n\n![local](C:\\me\\img.png)\n\nNext paragraph.\n",
  "Visit <https://example.com> or https://example.org today.\n\n~~strike~~ and www.example.net\n\n- [ ] open task\n- [x] done task\n",
  "> [!NOTE]\n> Useful note text.\n\n> [!WARNING]\n> Careful now.\n\nRegular paragraph.\n",
  `- install:\n\n  ${FENCE}sh\n  pnpm install\n  ${FENCE}\n\n- run:\n\n  ${FENCE}sh\n  pnpm dev\n  ${FENCE}\n\nDone with steps.\n`,
  "- point one\n\n  > quoted inside item\n\n- point two\n\nclosing line\n",
  "- bullet\n\n2024 was a good year.\n\n2025 will be better.\n",
  "Paragraph first.\n\n- list after paragraph\n- second\n\nParagraph after list.\n\n1. ordered\n2. again\n\nlast",
  "## Options\n\n- one\n- two\n\n## More\n\n1) paren one\n2) paren two\n",
  "+ plus item\n+ plus two\n\n* star item\n\ntext\n\n- dash\n",
  "first line\n   \nsecond after spaces\n\nthird\n",
  "alpha\n\n\n\nbeta\n\n\ngamma\n\n\n# Heading after many blanks\n\ndelta",
  "Escapes \\* and \\_ and &amp; &copy; and &#x41;.\n\nNext &lt;tag&gt; text.\n",
  "> a lazy quote\ncontinues lazily\n\nnot quoted\n",
  "- item\n- item two\n\n| a | b |\n|---|---|\n| 1 | 2 |\n\ntrailing prose\n",
  "1. first paragraph\n\n   second paragraph of item one\n\n2. item two\n\n   tail\n\nafter\n",
  "\u4e2d\u6587\u6bb5\u843d\u7b2c\u4e00\u884c\u3002\n\n\u7b2c\u4e8c\u6bb5 emoji \ud83d\ude42 \u4e0e **\u5f3a\u8c03**\u3002\n\nEnd.",
  "line one with two spaces  \nline two\n\nline three\\\nline four\n\nend",
  `Inline \`code with ${FENCE} marks\` here.\n\nNext paragraph with \`${TILDE}\` text.\n\nfinal`,
  "- a\n- b\n\nSub heading\n---\n\ntext\n",
  '[id]: https://example.com/id "Title"\n\nUse [id] here.\n\nAnd more.',
  "<details>\n<summary>More</summary>\n\nHidden content paragraph.\n\n</details>\n\nDone\n",
  Array.from(
    { length: 12 },
    (_, index) =>
      `Long prose paragraph ${index} with *emphasis*, \`code\`, and a [link](https://example.com/${index}).`,
  ).join("\n\n"),
];

/** Pseudo-random prefix lengths: each step is 1 to 50 characters, and the full document is always included. */
function sampledPrefixLengths(length: number, seed: number): number[] {
  const lengths: number[] = [];
  let state = seed;
  for (let end = 0; end < length;) {
    lengths.push(end);
    state = (state * 48271) % 2147483647;
    end += 1 + (state % 50);
  }
  lengths.push(length);
  return lengths;
}

function sameRender(actual: ReturnType<typeof render>, expected: ReturnType<typeof render>) {
  try {
    expect(actual).toEqual(expected);
    return true;
  } catch {
    return false;
  }
}

describe("streamed Markdown equivalence and parse work", () => {
  it("matches the full parse at every sampled prefix of the corpus", () => {
    expect(corpus.length).toBeGreaterThanOrEqual(40);
    const divergences: string[] = [];
    let checked = 0;
    corpus.forEach((document, index) => {
      for (let seed = 1; seed <= 4; seed++) {
        const incremental = createIncrementalMarkdownPlugin();
        for (const end of sampledPrefixLengths(document.length, index * 4 + seed)) {
          const text = document.slice(0, end);
          checked++;
          if (!sameRender(render(text, incremental), render(text))) {
            divergences.push(`document ${index} seed ${seed} prefix ${end}`);
          }
        }
      }
    });
    expect(checked).toBeGreaterThan(corpus.length * 10);
    expect(divergences).toEqual([]);
  });

  it.each([
    ["- a\n\nb", "- a\n\n- c", "- a\n\n  indented continuation", "- a\n\n\n- c"],
    ["1. one\n\nb", "1. one\n\n2. two", "1. one\n\n```\ncode\n```\n\nafter"],
    ["> quote\n\nb", "> quote\n\n> again\n\nb", "> quote\n>\n> more\n\nb"],
  ])("re-parses after an edit changes what follows a cached gap: %j", (...texts) => {
    const incremental = createIncrementalMarkdownPlugin();
    for (const text of texts) {
      expect(render(text, incremental), text).toEqual(render(text));
    }
  });

  it("parses far fewer characters while a 20 KB prose message streams in 50-character steps", () => {
    const message = Array.from(
      { length: 210 },
      (_, index) =>
        `Paragraph ${index} has *emphasis*, a [link](https://example.com/${index}), and ordinary prose for streaming.`,
    ).join("\n\n");
    expect(message.length).toBeGreaterThanOrEqual(20_000);
    const charactersParsed = (plugin?: Plugin<[], Root>) => {
      const parsedSources: string[] = [];
      for (let end = 50; ; end += 50) {
        parseOnly(message.slice(0, end), plugin, parsedSources);
        if (end >= message.length) break;
      }
      return parsedSources.reduce((total, text) => total + text.length, 0);
    };
    const streamed = charactersParsed(createIncrementalMarkdownPlugin());
    const fullParse = charactersParsed();
    expect(streamed).toBeLessThan(fullParse / 10);
  });
});
