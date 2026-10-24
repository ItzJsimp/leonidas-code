import { describe, expect, it } from "vite-plus/test";

import {
  centerSquare,
  dataUrlByteLength,
  fitsPictureLimit,
  LEONIDAS_DEFAULT_PICTURE,
  validatePictureFile,
  workspacePictureUrl,
} from "./workspacePicture.logic";

describe("workspacePictureUrl", () => {
  it("prefers the stored picture, then the Leonidas icon, then the letter", () => {
    const pictures = { simplygersi: "data:image/webp;base64,AAAA" };
    expect(workspacePictureUrl(pictures, "simplygersi")).toBe(pictures.simplygersi);
    expect(workspacePictureUrl(pictures, "leonidas")).toBe(LEONIDAS_DEFAULT_PICTURE);
    expect(workspacePictureUrl(pictures, undefined)).toBe(LEONIDAS_DEFAULT_PICTURE);
    expect(workspacePictureUrl(pictures, "clean-the-goo")).toBeNull();
    expect(workspacePictureUrl({ leonidas: "data:x" }, "leonidas")).toBe("data:x");
  });
});

describe("centerSquare", () => {
  it("crops the middle of wide and tall images", () => {
    expect(centerSquare(1000, 600)).toEqual({ x: 200, y: 0, size: 600 });
    expect(centerSquare(600, 1001)).toEqual({ x: 0, y: 200, size: 600 });
  });
});

describe("picture size checks", () => {
  it("validates type and size before upload", () => {
    expect(validatePictureFile({ type: "image/webp", size: 1 })).toBeNull();
    expect(validatePictureFile({ type: "image/svg+xml", size: 1 })).toMatch(/PNG/);
    expect(validatePictureFile({ type: "image/png", size: 0 })).toMatch(/empty/);
    expect(validatePictureFile({ type: "image/png", size: 21 * 1024 * 1024 })).toMatch(/20 MB/);
  });

  it("counts decoded bytes of a data URL", () => {
    expect(dataUrlByteLength("data:image/png;base64,AAAA")).toBe(3);
    expect(dataUrlByteLength("data:image/png;base64,AA==")).toBe(1);
    expect(fitsPictureLimit(`data:image/png;base64,${"A".repeat(400_000)}`)).toBe(false);
  });
});
