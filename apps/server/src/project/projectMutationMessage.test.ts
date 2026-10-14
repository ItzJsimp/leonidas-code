import { describe, expect, it } from "vite-plus/test";

import { describeProjectMutationFailure } from "./projectMutationMessage.ts";

describe("describeProjectMutationFailure", () => {
  it("keeps the message of a conflict error", () => {
    expect(
      describeProjectMutationFailure({
        message: "Workspace C:\\Users\\Gavin\\AIOS already belongs to project project:1.",
      }),
    ).toBe("Workspace C:\\Users\\Gavin\\AIOS already belongs to project project:1.");
  });

  it("adds the underlying reason from the cause chain", () => {
    const error = {
      message: "Project operation 'normalize-workspace' failed.",
      cause: {
        message: "Failed to create workspace root: C:\\Locked\\AIOS",
        cause: new Error("EPERM: operation not permitted, mkdir 'C:\\Locked\\AIOS'"),
      },
    };
    expect(describeProjectMutationFailure(error)).toBe(
      "Project operation 'normalize-workspace' failed. Failed to create workspace root: C:\\Locked\\AIOS. EPERM: operation not permitted, mkdir 'C:\\Locked\\AIOS'.",
    );
  });

  it("does not repeat a message that a cause already contains", () => {
    const error = { message: "Disk full", cause: new Error("Disk full") };
    expect(describeProjectMutationFailure(error)).toBe("Disk full.");
  });

  it("accepts a string cause", () => {
    expect(describeProjectMutationFailure({ message: "Command failed.", cause: "Rejected" })).toBe(
      "Command failed. Rejected.",
    );
  });

  it("falls back only when nothing readable exists", () => {
    expect(describeProjectMutationFailure({})).toBe("Failed to mutate project.");
    expect(describeProjectMutationFailure(undefined)).toBe("Failed to mutate project.");
  });
});
