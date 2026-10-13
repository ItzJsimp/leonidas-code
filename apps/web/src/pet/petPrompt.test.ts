import { describe, expect, it } from "vite-plus/test";

import { buildPetPrompt } from "./petPrompt";

describe("buildPetPrompt", () => {
  it("personalizes a transparent petdex sheet with all nine player states", () => {
    const prompt = buildPetPrompt({
      profileName: "Jake",
      brandColors: ["#dc143c", "#112233"],
      goals: ["Web apps", "Games"],
    });
    expect(prompt).toContain('"profileName":"Jake"');
    expect(prompt).toContain('"brandColors":["#dc143c","#112233"]');
    expect(prompt).toContain('"goals":["Web apps","Games"]');
    expect(prompt).toContain("1536x1872");
    expect(prompt).toContain("192x208");
    expect(prompt).toContain("transparent background");
    expect(prompt).toContain("Row 0: idle; 6 frames");
    expect(prompt).toContain("Row 1: running-right; 8 frames");
    expect(prompt).toContain("Row 2: running-left; 8 frames");
    expect(prompt).toContain("Row 3: waving; 4 frames");
    expect(prompt).toContain("Row 4: jumping; 5 frames");
    expect(prompt).toContain("Row 5: failed; 8 frames");
    expect(prompt).toContain("Row 6: waiting; 6 frames");
    expect(prompt).toContain("Row 7: running; 6 frames");
    expect(prompt).toContain("Row 8: review; 6 frames");
  });

  it("bounds personalization and falls back when profile and colors are unusable", () => {
    const prompt = buildPetPrompt({
      profileName: " \n ",
      brandColors: ["red", "#12345", "#zzzzzz"],
      goals: ["", "   ", ...Array.from({ length: 20 }, () => "x".repeat(500))],
    });
    const data = JSON.parse(prompt.split("\n\n")[2]!);
    expect(data.profileName).toBe("Leonidas");
    expect(data.brandColors).toEqual(["#dc143c"]);
    expect(data.goals).toHaveLength(8);
    expect(data.goals[0]).toHaveLength(80);
    expect(prompt.length).toBeLessThan(4000);
  });

  it("keeps quoted and multiline names as data and does not mutate the inputs", () => {
    const input = Object.freeze({
      profileName: '  Jake "Mob"\nSmith  ',
      brandColors: Object.freeze([" #ABC ", "#123456", "invalid"]),
      goals: Object.freeze([" Games ", "Web apps"]),
    });
    const prompt = buildPetPrompt(input);
    expect(buildPetPrompt(input)).toBe(prompt);
    expect(JSON.parse(prompt.split("\n\n")[2]!)).toEqual({
      profileName: 'Jake "Mob" Smith',
      brandColors: ["#abc", "#123456"],
      goals: ["Games", "Web apps"],
    });
    expect(input.goals[0]).toBe(" Games ");
    expect(
      JSON.parse(buildPetPrompt({ ...input, profileName: "a".repeat(500) }).split("\n\n")[2]!)
        .profileName,
    ).toHaveLength(80);
  });

  it("limits valid colors and goal answers to a small personalization payload", () => {
    const prompt = buildPetPrompt({
      profileName: "Jake",
      brandColors: Array.from({ length: 20 }, () => "#abc"),
      goals: Array.from({ length: 20 }, () => "Games"),
    });
    const data = JSON.parse(prompt.split("\n\n")[2]!);
    expect(data.brandColors).toHaveLength(8);
    expect(data.goals).toHaveLength(10);
  });
});
