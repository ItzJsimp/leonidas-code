// @effect-diagnostics nodeBuiltinImport:off - synchronous node APIs set up fixtures.
import * as NodeFS from "node:fs";
import * as NodeOS from "node:os";
import * as NodePath from "node:path";
import * as NodeServices from "@effect/platform-node/NodeServices";
import { assert, it } from "@effect/vitest";
import { formatReplyStyleFile, parseReplyStyleFile } from "@t3tools/contracts";
import * as Effect from "effect/Effect";
import { LEONIDAS_REPLY_STYLE } from "./outputStandard.ts";
import { listReplyStyles, loadReplyStyle } from "./replyStyles.ts";

const workspace = (files: Record<string, string>) => {
  const root = NodeFS.mkdtempSync(NodePath.join(NodeOS.tmpdir(), "reply-styles-"));
  const dir = NodePath.join(root, ".agents/reply-styles");
  NodeFS.mkdirSync(dir, { recursive: true });
  for (const [name, text] of Object.entries(files)) {
    NodeFS.writeFileSync(NodePath.join(dir, name), text);
  }
  return root;
};
const load = (root: string | null, slug: string | null) =>
  loadReplyStyle({ workspace: root, slug }).pipe(Effect.provide(NodeServices.layer));
const good = "---\nname: Terse\ndescription: Short replies\n---\n\nAnswer in one line.\n";

it.effect("uses Leonidas when nothing is selected", () =>
  Effect.gen(function* () {
    const style = yield* load(workspace({}), null);
    assert.strictEqual(style.body, LEONIDAS_REPLY_STYLE);
    assert.isUndefined(style.notice);
  }),
);

it.effect("loads a selected preset body without its frontmatter", () =>
  Effect.gen(function* () {
    const style = yield* load(workspace({ "terse.md": good }), "terse");
    assert.deepStrictEqual(style, { slug: "terse", name: "Terse", body: "Answer in one line." });
  }),
);

const fallbacks: ReadonlyArray<[string, Record<string, string>, string, string]> = [
  ["missing", {}, "terse", "missing"],
  ["empty", { "terse.md": "  \n" }, "terse", "empty"],
  ["an empty body", { "terse.md": "---\nname: Terse\n---\n\n" }, "terse", "empty"],
  ["without frontmatter", { "terse.md": "Answer in one line." }, "terse", "bad-frontmatter"],
  ["without a name", { "terse.md": "---\ndescription: x\n---\nBody" }, "terse", "bad-frontmatter"],
  ["over the cap", { "terse.md": `---\nname: T\n---\n${"x".repeat(4_001)}` }, "terse", "too-long"],
  ["a path, not a slug", {}, "../secrets", "bad-slug"],
];

it.effect.each(fallbacks)(
  "falls back to Leonidas with a notice when the preset is %s",
  ([, files, slug, problem]) =>
    Effect.gen(function* () {
      const style = yield* load(workspace(files), slug);
      assert.strictEqual(style.body, LEONIDAS_REPLY_STYLE);
      assert.deepStrictEqual(style.notice, { slug, problem });
    }),
);

it.effect("falls back with an unreadable notice when the preset path is a folder", () =>
  Effect.gen(function* () {
    const root = workspace({});
    NodeFS.mkdirSync(NodePath.join(root, ".agents/reply-styles/terse.md"));
    const style = yield* load(root, "terse");
    assert.deepStrictEqual(style.notice, { slug: "terse", problem: "unreadable" });
  }),
);

it.effect("lists Leonidas first and flags broken presets", () =>
  Effect.gen(function* () {
    const root = workspace({ "terse.md": good, "broken.md": "", "notes.txt": "skip" });
    const presets = yield* listReplyStyles(root).pipe(Effect.provide(NodeServices.layer));
    assert.deepStrictEqual(
      presets.map((preset) => [preset.slug, preset.builtin, preset.problem]),
      [
        ["leonidas", true, undefined],
        ["broken", false, "empty"],
        ["terse", false, undefined],
      ],
    );
  }),
);

it("round-trips the file Duplicate writes", () => {
  const text = formatReplyStyleFile({
    name: 'My "style"',
    description: "Mine",
    body: LEONIDAS_REPLY_STYLE,
  });
  assert.deepStrictEqual(parseReplyStyleFile(text), {
    name: 'My "style"',
    description: "Mine",
    body: LEONIDAS_REPLY_STYLE,
  });
});
