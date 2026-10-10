import { describe, expect, it } from "vite-plus/test";

import { maskedSensitiveText } from "./RedactedSensitiveText";

describe("maskedSensitiveText", () => {
  it("keeps the first character and the domain, hiding the rest behind a fixed run", () => {
    expect(maskedSensitiveText("jacobsimp2005@gmail.com")).toBe(
      "j\u2022\u2022\u2022\u2022\u2022\u2022@gmail.com",
    );
    expect(maskedSensitiveText("a@b.co")).toBe("a\u2022\u2022\u2022\u2022\u2022\u2022@b.co");
  });

  it("masks a value without a domain the same way", () => {
    expect(maskedSensitiveText("octocat")).toBe("o\u2022\u2022\u2022\u2022\u2022\u2022");
  });
});
