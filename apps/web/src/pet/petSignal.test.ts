import { describe, expect, it } from "vite-plus/test";

import { derivePetSignal, finishedPetSignal, IDLE_PET_SIGNAL } from "./petSignal";

type Activity = NonNullable<Parameters<typeof derivePetSignal>[0]>;

const activity = (
  now: Partial<Activity["now"]> & { text: string },
  waiting: Activity["waiting"] = [],
): Activity => ({
  now: { kind: "idle", running: true, ...now },
  waiting,
});

describe("derivePetSignal", () => {
  it("is idle with no active run", () => {
    expect(derivePetSignal(null)).toBe(IDLE_PET_SIGNAL);
  });

  it("sends shell work to the right as running and file edits to the left", () => {
    expect(derivePetSignal(activity({ kind: "command", text: "Ran tests" }))).toMatchObject({
      state: "running",
      anchor: "right",
      text: "Ran tests",
    });
    expect(derivePetSignal(activity({ kind: "write", text: "Editing a.ts" }))).toMatchObject({
      state: "running",
      anchor: "left",
    });
  });

  it("shows thinking and reading as review", () => {
    expect(derivePetSignal(activity({ kind: "think", text: "Thinking" }))).toMatchObject({
      state: "review",
      anchor: "center",
    });
    expect(derivePetSignal(activity({ kind: "read", text: "Reading b.ts" }))).toMatchObject({
      state: "review",
      anchor: "left",
    });
  });

  it("waits when the agent is blocked, even mid tool call", () => {
    const blocked = activity({ kind: "command", text: "Running build" }, [
      { id: "1", kind: "shell", source: "PowerShell", detail: "build", since: null },
    ]);
    expect(derivePetSignal(blocked).state).toBe("waiting");
  });

  it("drops the bubble between steps and truncates long text", () => {
    expect(derivePetSignal(activity({ kind: "read", running: false, text: "Read x" }))).toEqual(
      IDLE_PET_SIGNAL,
    );
    const long = derivePetSignal(activity({ kind: "tool", text: "x".repeat(100) }));
    expect(long.text).toHaveLength(48);
    expect(long.text?.endsWith("…")).toBe(true);
  });
});

describe("finishedPetSignal", () => {
  it("celebrates a finished run and grimaces at a failed one", () => {
    expect(finishedPetSignal(false).state).toBe("jumping");
    expect(finishedPetSignal(true).state).toBe("failed");
  });
});
