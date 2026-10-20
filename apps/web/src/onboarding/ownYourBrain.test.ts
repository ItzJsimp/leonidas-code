import { expect, it } from "vite-plus/test";
import { OWN_YOUR_BRAIN_LINE } from "./ownYourBrain";

it("keeps the approved positioning line", () => {
  expect(OWN_YOUR_BRAIN_LINE).toBe(
    "Your AI's brain is plain files you own. They work in Claude Code and Codex too.",
  );
});
