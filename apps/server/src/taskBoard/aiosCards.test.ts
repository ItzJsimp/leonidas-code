// @effect-diagnostics nodeBuiltinImport:off globalDate:off globalConsole:off - plain Node card parsing, no Effect runtime.
import { afterAll, beforeAll, describe, expect, it } from "@effect/vitest";
import * as NodeFS from "node:fs";
import * as NodeOS from "node:os";
import * as NodePath from "node:path";
import {
  applyCardPatch,
  cardToTask,
  createCardFile,
  discoverProjects,
  findAiosRoot,
  findCardFile,
  parseFrontmatter,
  readAiosTasks,
  resolveMember,
  statusFromCard,
  statusToCard,
  type AiosCardCache,
} from "./aiosCards.ts";

const NOW = new Date(2026, 9, 11, 14, 30).getTime();

describe("editable due dates", () => {
  it.each(["\n", "\r\n"])("sets and clears dates without damaging the card (%j)", (eol) => {
    const raw = card('id: task-date\nname: "Café"\ncustom: keep', "# Café\n\nDetails.\n", eol);
    const dated = applyCardPatch(raw, { actor: "Jake", due: "2026-10-12" }, NOW);
    expect(cardToTask({ fileName: "date.md", raw: dated, mtimeMs: NOW, now: NOW })?.due).toBe(
      "2026-10-12",
    );
    expect(dated).toContain(`custom: keep${eol}`);
    expect(dated).toContain("# Café");
    const cleared = applyCardPatch(dated, { actor: "Jake", due: null }, NOW);
    expect(
      cardToTask({ fileName: "date.md", raw: cleared, mtimeMs: NOW, now: NOW })?.due,
    ).toBeNull();
    expect(cleared).not.toMatch(/^due:/m);
  });
});

describe("editable milestones", () => {
  it("keeps legacy cards readable when their milestone is not a version", () => {
    expect(
      cardToTask({
        fileName: "legacy.md",
        raw: card("id: task-legacy\nname: Legacy\nmilestone: Alpha"),
        mtimeMs: NOW,
        now: NOW,
      })?.milestone,
    ).toBeNull();
  });
  it("creates, reads, updates and clears a milestone while preserving other card fields", () => {
    const root = NodeFS.mkdtempSync(NodePath.join(NodeOS.tmpdir(), "task-board-milestone-"));
    try {
      const created = createCardFile(
        root,
        {
          title: "Plan release",
          actor: "Jake",
          due: "2026-10-12",
          milestone: "0.22.0",
        },
        NOW,
      );
      expect(
        cardToTask({ fileName: created.fileName, raw: created.raw, mtimeMs: NOW, now: NOW }),
      ).toMatchObject({
        milestone: "0.22.0",
        due: "2026-10-12",
      });
      const updated = applyCardPatch(created.raw, { actor: "Jake", milestone: "1.0.0" }, NOW);
      expect(
        cardToTask({ fileName: created.fileName, raw: updated, mtimeMs: NOW, now: NOW })?.milestone,
      ).toBe("1.0.0");
      const cleared = applyCardPatch(updated, { actor: "Jake", milestone: null }, NOW);
      expect(
        cardToTask({ fileName: created.fileName, raw: cleared, mtimeMs: NOW, now: NOW })?.milestone,
      ).toBeNull();
      expect(cleared).not.toMatch(/^milestone:/m);
      expect(cleared).toContain('due: "2026-10-12"');
    } finally {
      NodeFS.rmSync(root, { recursive: true, force: true });
    }
  });
});
const card = (header: string, body = "# Title\n\nSome words.\n", eol = "\n") =>
  `---\n${header}\n---\n${body}`.replace(/\n/g, eol);

describe("parseFrontmatter", () => {
  it("handles quoted scalars, block lists, inline lists and unknown keys", () => {
    const parsed = parseFrontmatter(
      card(
        [
          'name: "Say \\"hi\\" \\\\ there"',
          "title: 'it''s'",
          "status: In progress",
          "start_files:",
          '  - "a.ts"',
          "  - b.ts",
          "tags: [one, \"two, three\", 'four']",
          'taste: ""',
          "empty:",
          "unknown_key: kept",
        ].join("\n"),
      ),
    );
    expect(parsed?.fields).toEqual({
      name: 'Say "hi" \\ there',
      title: "it's",
      status: "In progress",
      start_files: ["a.ts", "b.ts"],
      tags: ["one", "two, three", "four"],
      taste: "",
      empty: "",
      unknown_key: "kept",
    });
    expect(parsed?.body).toBe("# Title\n\nSome words.\n");
  });

  it("reads CRLF and a UTF-8 BOM", () => {
    const parsed = parseFrontmatter(
      "\uFEFF" + card('name: "A"\nstatus: Done', "# A\nbody\n", "\r\n"),
    );
    expect(parsed?.fields).toEqual({ name: "A", status: "Done" });
    expect(parsed?.body).toBe("# A\r\nbody\r\n");
  });

  it("returns null without frontmatter", () => {
    expect(parseFrontmatter("# just a note\n")).toBeNull();
    expect(parseFrontmatter("---\nname: x\nno closing line\n")).toBeNull();
  });
});

describe("status mapping", () => {
  it("maps card spellings and aliases both ways", () => {
    expect(statusFromCard("Not started")).toBe("todo");
    expect(statusFromCard("IN PROGRESS")).toBe("in_progress");
    expect(statusFromCard("in_progress")).toBe("in_progress");
    expect(statusFromCard("active")).toBe("in_progress");
    expect(statusFromCard("Awaiting Review")).toBe("review");
    expect(statusFromCard("Blocked")).toBe("blocked");
    expect(statusFromCard("completed")).toBe("done");
    expect(statusFromCard("finished")).toBe("done");
    expect(statusFromCard("Dormant")).toBe("parked");
    expect(statusFromCard("Retired")).toBe("retired");
    expect(statusFromCard("whatever")).toBe("todo");
    expect(statusFromCard(undefined)).toBe("todo");
    expect(statusToCard("review")).toBe("Awaiting Review");
    expect(statusToCard("parked")).toBe("Dormant");
    expect(statusToCard("in_progress")).toBe("In progress");
  });
});

describe("cardToTask", () => {
  const base = { mtimeMs: NOW, now: NOW };

  it("maps a full card", () => {
    const task = cardToTask({
      ...base,
      fileName: "Do The Thing.md",
      raw: card(
        [
          "type: task",
          "id: task-do-the-thing",
          'name: "Do the thing"',
          'status: "In progress"',
          "owner: leonidas",
          'accountable: "Jake"',
          'priority: "High"',
          'energy_type: "Deep Work"',
          'effort: "Medium"',
          "created: 2026-10-01",
          "last_touched: 2026-10-05",
          'project: "projects/Project-Leonidas-Code"',
          'lane: "leonidas"',
          "tags: [alpha, beta]",
          'verify: "pytest"',
          'due: "2026-10-20"',
          'start_files: ["a.ts", "b.ts"]',
          "blocked_by:",
          '  - "tasks/other.md"',
          'claimed_by: "Mob"',
          'thread_id: "thread-1"',
        ].join("\n"),
        "\n# Do the thing\n\nWhy.\n\n## Done when\n\n- [x] one\n- [ ] two\n  - [X] three\n\n## Notes\n\n- [ ] not counted\n",
      ),
    });
    expect(task).toMatchObject({
      id: "task-do-the-thing",
      title: "Do the thing",
      status: "in_progress",
      priority: "high",
      project: "leonidas-code",
      projectSlug: "leonidas-code",
      effort: "Medium",
      energy: "Deep Work",
      due: "2026-10-20",
      verify: "pytest",
      startFiles: ["a.ts", "b.ts"],
      blockedBy: ["tasks/other.md"],
      labels: ["alpha", "beta", "leonidas"],
      claimedBy: "Mob",
      claimedAgent: { threadId: "thread-1" },
      completedBy: null,
      source: "aios_card",
      sourceId: "task-do-the-thing",
      sourceFile: "Do The Thing.md",
      issueUrl: null,
      shared: false,
      checklist: { done: 2, total: 3 },
    });
    expect(task?.description.startsWith("Why.")).toBe(true);
    expect(task?.description).not.toContain("# Do the thing");
    expect(task?.createdAt).toBe(new Date(2026, 9, 1).getTime());
    expect(task?.updatedAt).toBe(NOW);
  });

  it("derives a stable id from the filename and keeps domain slugs", () => {
    const raw = card('name: "Pay"\nproject: "domains/finances"');
    const a = cardToTask({ ...base, fileName: "Pay The Rent!.md", raw });
    expect(a?.id).toBe("task-pay-the-rent");
    expect(a?.projectSlug).toBe("domains/finances");
    expect(a?.sourceId).toBe("Pay The Rent!");
    expect(cardToTask({ ...base, fileName: "Pay The Rent!.md", raw })?.id).toBe(a?.id);
  });

  it("falls back to general, ignores non-task cards and does not invent a claimer", () => {
    const task = cardToTask({
      ...base,
      fileName: "x.md",
      raw: card('name: "X"\naccountable: "Jake"'),
    });
    expect(task).toMatchObject({
      project: "general",
      projectSlug: null,
      claimedBy: null,
      claimedAgent: null,
    });
    expect(
      cardToTask({ ...base, fileName: "i.md", raw: card("type: index\nname: Index") }),
    ).toBeNull();
    expect(cardToTask({ ...base, fileName: "n.md", raw: "# no frontmatter\n" })).toBeNull();
    expect(cardToTask({ ...base, fileName: "n.md", raw: card("owner: leonidas") })).toBeNull();
  });

  it("fills completion fields for Done cards", () => {
    const task = cardToTask({
      ...base,
      fileName: "d.md",
      raw: card(
        'name: "D"\nstatus: "Done"\naccountable: "Jake"\nlast_touched: 2026-10-02\ncompleted_date: 2026-10-03',
        "# D\n\n## Resolution & AI Depth\n\n- **Resolution Summary:** Shipped it.\n",
      ),
    });
    expect(task).toMatchObject({
      status: "done",
      completedBy: "Jake",
      completedAt: new Date(2026, 9, 3).getTime(),
      completionSummary: "Shipped it.",
    });
  });

  it("parses the Activity section into history and keeps it out of the description", () => {
    const task = cardToTask({
      ...base,
      fileName: "a.md",
      raw: card(
        'id: task-a\nname: "A"',
        "# A\n\nBody.\n\n## Activity\n\n- 2026-10-11 09:05 Jake (Claude Opus): claimed — starting\n- 2026-10-11 10:00 Mob: status → Blocked\n- 2026-10-11 11:00 Mob: completed\n\n## After\n\ntail\n",
      ),
    });
    expect(task?.description).toBe("Body.\n\n## After\n\ntail");
    expect(task?.history).toHaveLength(3);
    expect(task?.history[0]).toMatchObject({
      id: "task-a-act-0",
      action: "claimed",
      actor: "Jake",
      note: "starting",
      agent: { model: "Claude Opus" },
      timestamp: new Date(2026, 9, 11, 9, 5).getTime(),
    });
    expect(task?.history[1]).toMatchObject({ action: "progress", note: "status → Blocked" });
    expect(task?.history[2]).toMatchObject({ action: "completed", note: null });
  });
});

describe("applyCardPatch", () => {
  const header = [
    "type: task",
    "id: task-a",
    'name: "A"',
    'status: "Not started"',
    'priority: "Medium"',
    "created: 2026-10-01",
    "last_touched: 2026-10-01",
    "start_files:",
    '  - "x.ts"',
    "mystery_key:   spaced   value",
    "# stray comment",
  ].join("\n");
  const patchBase = { actor: "Jake" } as const;

  it("writes effort and labels onto the card and reads them back", () => {
    const next = applyCardPatch(
      card(header),
      { ...patchBase, effort: "Low", labels: ["bug", "ui"] },
      NOW,
    );
    expect(next).toContain('effort: "Low"');
    expect(next).toContain('tags: ["bug", "ui"]');
    expect(next).toContain("effort → Low, labels → bug, ui");
    const task = cardToTask({ fileName: "a.md", raw: next, mtimeMs: NOW, now: NOW });
    expect(task).toMatchObject({ effort: "Low", labels: ["bug", "ui"] });
  });

  it("round-trips a claim through cardToTask", () => {
    const raw = card(header);
    const next = applyCardPatch(
      raw,
      {
        ...patchBase,
        status: "in_progress",
        claimedBy: "Jake",
        agentLabel: "Claude",
        threadId: "t-9",
      },
      NOW,
    );
    expect(next).toContain('status: "In progress"');
    expect(next).toContain('claimed_by: "Jake"');
    expect(next).toContain('thread_id: "t-9"');
    expect(next).toContain("last_touched: 2026-10-11");
    expect(next).toContain("## Activity\n\n- 2026-10-11 14:30 Jake (Claude): claimed\n");

    const task = cardToTask({ fileName: "a.md", raw: next, mtimeMs: NOW, now: NOW });
    expect(task).toMatchObject({
      status: "in_progress",
      claimedBy: "Jake",
      claimedAgent: { threadId: "t-9" },
      claimedAt: NOW,
    });
    expect(task?.history).toHaveLength(1);
    expect(task?.history[0]).toMatchObject({
      action: "claimed",
      actor: "Jake",
      agent: { model: "Claude" },
    });
  });

  it("keeps every untouched line byte for byte", () => {
    const raw = card(header);
    const next = applyCardPatch(raw, { ...patchBase, priority: "high" }, NOW);
    const untouched = [
      "mystery_key:   spaced   value",
      "# stray comment",
      "start_files:",
      '  - "x.ts"',
      "created: 2026-10-01",
    ];
    for (const line of untouched) expect(next).toContain(`${line}\n`);
    expect(next).toContain('priority: "High"');
    expect(
      next
        .split("\n")
        .filter((line) => !line.startsWith("priority") && !line.startsWith("last_touched"))
        .slice(0, 11),
    ).toEqual(
      raw
        .split("\n")
        .filter((line) => !line.startsWith("priority") && !line.startsWith("last_touched"))
        .slice(0, 11),
    );
  });

  it("preserves CRLF and the BOM, including in the appended activity", () => {
    const raw = "\uFEFF" + card(header, "# A\n\nBody.\n", "\r\n");
    const next = applyCardPatch(raw, { ...patchBase, status: "done" }, NOW);
    expect(next.startsWith("\uFEFF---\r\n")).toBe(true);
    expect(next.replace(/\r\n/g, "")).not.toContain("\n");
    expect(next).toContain('status: "Done"\r\n');
    expect(next).toContain("completed_date: 2026-10-11\r\n");
    expect(next).toMatch(
      /Body\.\r\n\r\n## Activity\r\n\r\n- 2026-10-11 14:30 Jake: completed\r\n$/,
    );
  });

  it("sets and clears completed_date, project, claimed_by and thread_id", () => {
    const done = applyCardPatch(
      card(header),
      { ...patchBase, status: "done", projectSlug: "leonidas-code" },
      NOW,
    );
    expect(done).toContain('project: "leonidas-code"');
    expect(done).toContain("linked to project leonidas-code");
    const reopened = applyCardPatch(
      done,
      { ...patchBase, status: "in_progress", claimedBy: "Mob", threadId: "t" },
      NOW,
    );
    expect(reopened).not.toContain("completed_date");
    expect(reopened).toContain("reopened");
    const released = applyCardPatch(
      reopened,
      { ...patchBase, status: "todo", claimedBy: null, projectSlug: null },
      NOW,
    );
    expect(released).not.toContain("claimed_by");
    expect(released).not.toContain("thread_id");
    expect(released).not.toMatch(/^project:/m);
    const task = cardToTask({ fileName: "a.md", raw: released, mtimeMs: NOW, now: NOW });
    expect(task).toMatchObject({ status: "todo", claimedBy: null, projectSlug: null });
    expect(task?.history.map((entry) => entry.action)).toEqual([
      "completed",
      "reopened",
      "released",
    ]);
  });

  it("appends to an Activity section that is not last, and adds notes", () => {
    const raw = card(
      header,
      "# A\n\n## Activity\n\n- 2026-10-10 08:00 Mob: claimed\n\n## Later\n\ntext\n",
    );
    const next = applyCardPatch(raw, { ...patchBase, note: "half done" }, NOW);
    expect(next).toContain(
      "- 2026-10-10 08:00 Mob: claimed\n- 2026-10-11 14:30 Jake: progress — half done\n\n## Later\n\ntext\n",
    );
  });

  it("returns the card untouched when nothing changes and rejects cards without frontmatter", () => {
    const raw = card(header);
    expect(applyCardPatch(raw, { ...patchBase, status: "todo", priority: "medium" }, NOW)).toBe(
      raw,
    );
    expect(() => applyCardPatch("# nope\n", patchBase, NOW)).toThrow("invalid_card");
  });

  it("records shared sync state without logging activity, and drops it when sharing stops", () => {
    const shared = applyCardPatch(card(header), { ...patchBase, shared: true }, NOW);
    const failed = applyCardPatch(shared, { ...patchBase, sharedSync: "failed" }, NOW);
    expect(failed).toContain("shared_sync: failed\n");
    expect(failed.split("Jake:").length).toBe(shared.split("Jake:").length);
    expect(cardToTask({ fileName: "a.md", raw: failed, mtimeMs: NOW, now: NOW })).toMatchObject({
      sharedSync: "failed",
    });
    expect(applyCardPatch(failed, { ...patchBase, sharedSync: null }, NOW)).toBe(shared);
    const withdrawn = applyCardPatch(failed, { ...patchBase, shared: false }, NOW);
    expect(withdrawn).not.toMatch(/^shared_sync:/m);
  });

  it("writes and removes the shared keys and reads them back", () => {
    const raw = card(header);
    expect(cardToTask({ fileName: "a.md", raw, mtimeMs: NOW, now: NOW })).toMatchObject({
      shared: false,
    });

    const shared = applyCardPatch(raw, { ...patchBase, shared: true, sharedBy: "Jake" }, NOW);
    expect(shared).toContain("shared: true\n");
    expect(shared).toContain('shared_by: "Jake"\n');
    expect(shared).toContain("Jake: shared with collaborators");
    const task = cardToTask({ fileName: "a.md", raw: shared, mtimeMs: NOW, now: NOW });
    expect(task).toMatchObject({ shared: true, sharedBy: "Jake" });

    // Sharing again by the same person changes nothing.
    expect(applyCardPatch(shared, { ...patchBase, shared: true, sharedBy: "Jake" }, NOW)).toBe(
      shared,
    );

    const withdrawn = applyCardPatch(shared, { ...patchBase, shared: false }, NOW);
    expect(withdrawn).not.toMatch(/^shared(_by)?:/m);
    expect(withdrawn).toContain("stopped sharing");
    const after = cardToTask({ fileName: "a.md", raw: withdrawn, mtimeMs: NOW, now: NOW });
    expect(after).toMatchObject({ shared: false });
    expect(after).not.toHaveProperty("sharedBy");
    // Clearing a card that is not shared is a no-op.
    expect(applyCardPatch(raw, { ...patchBase, shared: null }, NOW)).toBe(raw);
  });
});

describe("AIOS folder reading", () => {
  let root = "";
  let symlinks = true;

  beforeAll(() => {
    root = NodeFS.mkdtempSync(NodePath.join(NodeOS.tmpdir(), "aios-cards-"));
    const write = (relative: string, content: string) => {
      const file = NodePath.join(root, relative);
      NodeFS.mkdirSync(NodePath.dirname(file), { recursive: true });
      NodeFS.writeFileSync(file, content);
    };
    write(
      "tasks/alpha.md",
      card('id: task-alpha\nname: "Alpha"\nstatus: "Not started"\nproject: "beta"'),
    );
    write(
      "tasks/crlf.md",
      "\uFEFF" + card('id: task-crlf\nname: "Crlf"\nstatus: "Done"', "# Crlf\n", "\r\n"),
    );
    write("tasks/README.md", "# readme\n");
    write("tasks/tasks-index.md", card("type: index\nname: Index"));
    write("tasks/_staged/hidden.md", card('name: "Hidden"'));
    write("tasks/broken.md", "---\nname: [unclosed\n");
    write("projects/beta/tasks/local.md", card('id: task-local\nname: "Local"'));
    write(
      "projects/beta/project.md",
      '---\ntype: project\nname: "Frontmatter Name"\n---\n# Beta Project\n',
    );
    write(
      "projects/leonidas-code/project.md",
      '---\ntype: project\nname: "Leonidas Code"\n---\n# Leonidas Code: project ledger\n',
    );
    write("projects/projects-index.md", "# index\n");
    write("projects/_archive/x/project.md", "# no\n");
    try {
      NodeFS.symlinkSync(
        NodePath.join(root, "tasks", "alpha.md"),
        NodePath.join(root, "projects", "beta", "tasks", "alpha.md"),
      );
    } catch {
      symlinks = false;
    }
  });

  afterAll(() => {
    NodeFS.rmSync(root, { recursive: true, force: true });
  });

  it("finds the root from hints and ancestors", () => {
    const deep = NodePath.join(root, "projects", "beta");
    expect(findAiosRoot([undefined, "", NodePath.join(root, "nope"), deep])).toBe(root);
    expect(findAiosRoot([root])).toBe(root);
    expect(findAiosRoot([NodePath.join(root, "nope", "deeper")])).toBe(root);
    expect(findAiosRoot([NodePath.join(NodeOS.tmpdir(), "no-such-aios-dir-xyz")])).toBeNull();
  });

  it("reads global and project cards, skips noise and dedupes symlinked cards", () => {
    const tasks = readAiosTasks(root, { now: NOW });
    const ids = tasks.map((task) => task.id).sort();
    expect(ids).toEqual(["task-alpha", "task-crlf", "task-local"]);
    expect(tasks.find((task) => task.id === "task-local")?.projectSlug).toBe("beta");
    expect(tasks.find((task) => task.id === "task-alpha")?.projectSlug).toBe("beta");
    expect(tasks.find((task) => task.id === "task-crlf")?.status).toBe("done");
  });

  it("reuses cached parses for unchanged files only", () => {
    const cache: AiosCardCache = new Map();
    const first = readAiosTasks(root, { now: NOW, cache });
    expect(cache.size).toBeGreaterThanOrEqual(first.length);
    // The symlinked copy of alpha.md resolves to a file already read, so it adds no cache entry.
    if (symlinks) expect(cache.size).toBe(5);
    const sentinel = [...cache.entries()].find(([, entry]) => entry.task?.id === "task-local");
    expect(sentinel).toBeDefined();
    const [file, entry] = sentinel!;
    cache.set(file, { ...entry, task: { ...entry.task!, title: "From cache" } });
    expect(
      readAiosTasks(root, { now: NOW, cache }).find((task) => task.id === "task-local")?.title,
    ).toBe("From cache");
    cache.set(file, { ...entry, size: entry.size + 1, task: { ...entry.task!, title: "Stale" } });
    expect(
      readAiosTasks(root, { now: NOW, cache }).find((task) => task.id === "task-local")?.title,
    ).toBe("Local");
  });

  it("keeps the global card when two cards share an id", () => {
    NodeFS.writeFileSync(
      NodePath.join(root, "projects", "beta", "tasks", "dup.md"),
      card('id: task-alpha\nname: "Dup"'),
    );
    try {
      const alpha = readAiosTasks(root, { now: NOW }).filter((task) => task.id === "task-alpha");
      expect(alpha).toHaveLength(1);
      expect(alpha[0]?.title).toBe("Alpha");
    } finally {
      NodeFS.rmSync(NodePath.join(root, "projects", "beta", "tasks", "dup.md"));
    }
  });

  it("returns an empty list for a missing root", () => {
    expect(readAiosTasks(NodePath.join(root, "missing"), { now: NOW })).toEqual([]);
  });

  it("finds card files for editing", () => {
    expect(findCardFile(root, "alpha.md")).toBe(NodePath.join(root, "tasks", "alpha.md"));
    expect(findCardFile(root, "local.md")).toBe(
      NodePath.join(root, "projects", "beta", "tasks", "local.md"),
    );
    expect(findCardFile(root, "../alpha.md")).toBeNull();
    expect(findCardFile(root, "missing.md")).toBeNull();
  });

  it("discovers projects with names from project.md or the slug", () => {
    const projects = discoverProjects(root);
    expect(projects.map((project) => project.slug).sort()).toEqual(["beta", "leonidas-code"]);
    expect(projects.find((project) => project.slug === "beta")?.name).toBe("Frontmatter Name");
    expect(projects.find((project) => project.slug === "leonidas-code")?.name).toBe(
      "Leonidas Code",
    );
  });

  it("creates uniquely named cards and never overwrites", () => {
    const first = createCardFile(
      root,
      {
        title: "Write the Docs!",
        description: "Details.",
        priority: "high",
        projectSlug: "beta",
        actor: "Jake",
      },
      NOW,
    );
    const second = createCardFile(root, { title: "Write the Docs!", actor: "Jake" }, NOW);
    expect(first.fileName).toBe("write-the-docs.md");
    expect(second.fileName).toBe("write-the-docs-2.md");
    expect(second.id).toBe("task-write-the-docs-2");
    expect(NodeFS.readFileSync(NodePath.join(root, "tasks", first.fileName), "utf8")).toBe(
      first.raw,
    );
    expect(first.raw).toContain('priority: "High"');
    expect(first.raw).toContain('project: "beta"');
    expect(second.raw).not.toContain("project:");
    expect(second.raw).not.toContain("effort:");
    expect(
      createCardFile(root, { title: "x".repeat(300), actor: "Jake" }, NOW).fileName.length,
    ).toBeLessThanOrEqual(83);

    const task = cardToTask({ fileName: first.fileName, raw: first.raw, mtimeMs: NOW, now: NOW });
    expect(task).toMatchObject({
      id: first.id,
      title: "Write the Docs!",
      status: "todo",
      priority: "high",
      description: "Details.",
    });
  });
});

describe("resolveMember", () => {
  it("prefers LEONIDAS_MEMBER and otherwise returns something non-empty", () => {
    expect(resolveMember({ LEONIDAS_MEMBER: " Mob " })).toBe("Mob");
    expect(resolveMember({}).length).toBeGreaterThan(0);
  });
});

describe("real AIOS", () => {
  const realRoot = "D:/Leonidas AIOS";
  it.skipIf(!NodeFS.existsSync("D:/Leonidas AIOS/tasks"))("reads every real card quickly", () => {
    const started = performance.now();
    const tasks = readAiosTasks(realRoot, { now: Date.now() });
    const elapsed = performance.now() - started;
    expect(tasks.length).toBeGreaterThan(100);
    for (const task of tasks) {
      expect(task.id).not.toBe("");
      expect(task.title).not.toBe("");
    }
    expect(new Set(tasks.map((task) => task.id)).size).toBe(tasks.length);
    expect(elapsed).toBeLessThan(500);

    const cache: AiosCardCache = new Map();
    readAiosTasks(realRoot, { now: Date.now(), cache });
    const warmStarted = performance.now();
    readAiosTasks(realRoot, { now: Date.now(), cache });
    expect(performance.now() - warmStarted).toBeLessThan(150);
  });
});
