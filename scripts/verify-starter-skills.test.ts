import { describe, expect, it } from "vite-plus/test";

import { run } from "./verify-starter-skills.ts";

describe("verify-starter-skills process runner", () => {
  it("captures shell output and interrupts timed out commands", async () => {
    const completed = await run(`node -e "process.stdout.write('ok')"`, ".", 5_000);
    expect(completed).toMatchObject({ stdout: "ok", status: 0, error: undefined });

    const timedOut = await run(
      `node -e "process.stdout.write('partial'); setTimeout(() => {}, 2000)"`,
      ".",
      700,
    );
    expect(timedOut.status).toBeNull();
    expect(timedOut.error).toBeInstanceOf(Error);
    expect(timedOut.stdout).toBe("partial");
  });
});
