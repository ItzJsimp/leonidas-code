// @effect-diagnostics nodeBuiltinImport:off - synchronous node and global APIs are used on purpose in this file.
import * as NodeFS from "node:fs";
import * as NodeOS from "node:os";
import * as NodePath from "node:path";
import * as NodeServices from "@effect/platform-node/NodeServices";
import { assert, it } from "@effect/vitest";
import * as HostProcess from "@t3tools/shared/HostProcess";
import * as Effect from "effect/Effect";
import { expandSkillMentionsFromDisk } from "./skillMentions.ts";

const temp = (label: string) =>
  NodeFS.mkdtempSync(NodePath.join(NodeOS.tmpdir(), `skills-${label}-`));

const writeSkill = (root: string, folder: string, name: string, body: string) => {
  const dir = NodePath.join(root, folder, name);
  NodeFS.mkdirSync(dir, { recursive: true });
  NodeFS.writeFileSync(NodePath.join(dir, "SKILL.md"), body);
};

const run = (text: string, cwd: string | null, home: string) =>
  expandSkillMentionsFromDisk({ text, cwd }).pipe(
    Effect.provideService(HostProcess.HomeDirectory, home),
    Effect.provide(NodeServices.layer),
  );

it.effect("expands a project skill with its arguments", () =>
  Effect.gen(function* () {
    const cwd = temp("cwd");
    writeSkill(cwd, ".agents/skills", "tdd", "---\nname: tdd\n---\nWrite the test first.\n");
    const out = yield* run("please $tdd the parser", cwd, temp("home"));
    assert.include(out, '<skill name="tdd"/>');
    assert.include(out, "Write the test first.");
    assert.include(out, "ARGUMENTS: the parser");
  }),
);

it.effect("handles several mentions and a repeated mention once", () =>
  Effect.gen(function* () {
    const cwd = temp("cwd");
    writeSkill(cwd, ".agents/skills", "a", "Alpha body\n");
    writeSkill(cwd, ".claude/skills", "b", "Beta body\n");
    const out = yield* run("/a one $b two $a three", cwd, temp("home"));
    assert.equal(out.split("Alpha body").length - 1, 1);
    assert.include(out, "Beta body");
  }),
);

it.effect("leaves unknown names, file paths and plain prose unchanged", () =>
  Effect.gen(function* () {
    const cwd = temp("cwd");
    writeSkill(cwd, ".agents/skills", "real", "Body\n");
    const text = "look at /src/index.ts and $HOME and $nothing and 5 $5";
    assert.equal(yield* run(text, cwd, temp("home")), text);
  }),
);

it.effect("project skills win over user skills, and user skills work without a cwd", () =>
  Effect.gen(function* () {
    const cwd = temp("cwd");
    const home = temp("home");
    writeSkill(home, ".agents/skills", "same", "USER version\n");
    writeSkill(cwd, ".agents/skills", "same", "PROJECT version\n");
    writeSkill(home, ".claude/skills", "only-user", "Only user\n");
    const both = yield* run("$same", cwd, home);
    assert.include(both, "PROJECT version");
    assert.notInclude(both, "USER version");
    assert.include(yield* run("$only-user", null, home), "Only user");
  }),
);

it.effect("keeps attachment text that is already part of the prompt", () =>
  Effect.gen(function* () {
    const cwd = temp("cwd");
    writeSkill(cwd, ".agents/skills", "note", "Note body\n");
    const out = yield* run("$note\n\n[Attachment saved at /tmp/a.txt]", cwd, temp("home"));
    assert.include(out, "[Attachment saved at /tmp/a.txt]");
  }),
);

it.effect("rejects names that try to leave the skill folder", () =>
  Effect.gen(function* () {
    const cwd = temp("cwd");
    NodeFS.writeFileSync(NodePath.join(cwd, "SKILL.md"), "secret\n");
    const text = "$..";
    assert.equal(yield* run(text, cwd, temp("home")), text);
  }),
);
