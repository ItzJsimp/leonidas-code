import { CONTENT_STAGES } from "@t3tools/contracts";
import { describe, expect, it } from "@effect/vitest";

import { canMove } from "./stages.ts";

const ok = (from: string, to: string, kind: "agent" | "member") =>
  canMove(from as never, to as never, kind).ok;

describe("canMove", () => {
  it("lets an agent move only from idea to script review", () => {
    const allowed = CONTENT_STAGES.flatMap((from) =>
      CONTENT_STAGES.filter((to) => ok(from, to, "agent")).map((to) => `${from}>${to}`),
    );
    expect(allowed).toEqual(["idea>scripting", "scripting>script_review"]);
  });

  it("never lets an agent approve, deliver or mark paid", () => {
    expect(ok("script_review", "ready_to_film", "agent")).toBe(false);
    expect(ok("cut_review", "delivered", "agent")).toBe(false);
    expect(ok("delivered", "paid", "agent")).toBe(false);
    const check = canMove("script_review", "ready_to_film", "agent");
    expect(check.ok ? "" : check.reason).toMatch(/person/);
  });

  it("moves a person one step forward on the allowed paths", () => {
    expect(ok("script_review", "ready_to_film", "member")).toBe(true);
    expect(ok("script_review", "scripting", "member")).toBe(true);
    expect(ok("cut_review", "delivered", "member")).toBe(true);
    expect(ok("revision_1", "delivered", "member")).toBe(true);
    expect(ok("revision_2", "delivered", "member")).toBe(true);
    expect(ok("delivered", "paid", "member")).toBe(true);
    expect(ok("idea", "ready_to_film", "member")).toBe(false);
    expect(ok("scripting", "filmed", "member")).toBe(false);
    expect(ok("paid", "paid", "member")).toBe(false);
  });

  it("lets a person undo one step back along an allowed move", () => {
    expect(canMove("ready_to_film", "script_review", "member")).toEqual({ ok: true, undo: true });
    expect(canMove("filmed", "ready_to_film", "member")).toEqual({ ok: true, undo: true });
    expect(canMove("delivered", "cut_review", "member")).toEqual({ ok: true, undo: true });
    expect(ok("filmed", "script_review", "member")).toBe(false);
    expect(ok("ready_to_film", "script_review", "agent")).toBe(false);
  });
});
