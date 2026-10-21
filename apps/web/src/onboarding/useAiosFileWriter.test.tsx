// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { EnvironmentId } from "@t3tools/contracts";
import { afterEach, beforeEach, expect, it, vi } from "vite-plus/test";

import type { PlannedFile } from "./aiosInterview.logic";

const mocks = vi.hoisted(() => ({
  inspect: vi.fn(),
  ensureFolderProject: vi.fn(),
  writeFile: vi.fn(),
}));

vi.mock("./useOnboardingChat", () => ({
  useOnboardingChat: () => ({ canOperate: true, ensureFolderProject: mocks.ensureFolderProject }),
}));
vi.mock("./useFolderInspection", () => ({ useFolderInspection: () => mocks.inspect }));
vi.mock("~/state/session", () => ({ useEnvironmentScope: () => true }));
vi.mock("~/state/projects", () => ({ projectEnvironment: { writeFile: {} } }));
vi.mock("~/state/use-atom-command", () => ({ useAtomCommand: () => mocks.writeFile }));
vi.mock("@t3tools/client-runtime/state/runtime", () => ({
  isAtomCommandInterrupted: () => false,
  squashAtomCommandFailure: () => new Error("Disk full."),
}));

const { useAiosFileWriter } = await import("./useAiosFileWriter");

type Writer = ReturnType<typeof useAiosFileWriter>;
let writer: Writer;
let root: Root;
let container: HTMLDivElement;

function Probe() {
  writer = useAiosFileWriter(EnvironmentId.make("local"));
  return null;
}

const files: readonly PlannedFile[] = [
  { relativePath: "CLAUDE.md", contents: "a" },
  { relativePath: "memory/README.md", contents: "b" },
];

beforeEach(async () => {
  vi.clearAllMocks();
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  mocks.inspect.mockResolvedValue({ _tag: "directory", existingFiles: [] });
  mocks.ensureFolderProject.mockResolvedValue({
    ok: true,
    projectId: "p1",
    workspaceRoot: "C:/aios",
  });
  mocks.writeFile.mockResolvedValue({ _tag: "Success" });
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  await act(async () => root.render(<Probe />));
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

it("writes every planned file and keeps files that already exist", async () => {
  mocks.inspect.mockResolvedValue({ _tag: "directory", existingFiles: ["CLAUDE.md"] });
  const result = await writer.write("C:/aios", files);
  expect(result).toEqual({ ok: true, created: ["memory/README.md"], skipped: ["CLAUDE.md"] });
  expect(mocks.writeFile).toHaveBeenCalledOnce();
});

it("stops before writing when the folder cannot be checked or read", async () => {
  mocks.inspect.mockResolvedValueOnce({ _tag: "unknown" });
  expect(await writer.write("C:/aios", files)).toMatchObject({ ok: false });
  mocks.inspect.mockResolvedValueOnce({ _tag: "unreadable" });
  expect(await writer.write("C:/aios", files)).toMatchObject({ ok: false });
  expect(mocks.writeFile).not.toHaveBeenCalled();
});

it("names the file that failed and says saved files are kept", async () => {
  mocks.writeFile
    .mockResolvedValueOnce({ _tag: "Success" })
    .mockResolvedValueOnce({ _tag: "Failure" });
  const result = await writer.write("C:/aios", files);
  expect(result.ok).toBe(false);
  if (!result.ok) {
    expect(result.message).toContain("memory/README.md");
    expect(result.message).toContain("Disk full.");
    expect(result.message).toContain("Files already saved are kept.");
  }
});

it("fails without writing when the folder cannot be used", async () => {
  mocks.ensureFolderProject.mockResolvedValueOnce({ ok: false, message: "no" });
  expect(await writer.write("C:/aios", files)).toMatchObject({ ok: false });
  expect(mocks.writeFile).not.toHaveBeenCalled();
});

it("asks before adding files to a folder that already has other files", async () => {
  mocks.inspect.mockResolvedValue({
    _tag: "directory",
    existingFiles: [],
    fileCount: 12,
    directoryCount: 3,
  });
  const first = await writer.write("C:/code/app", files);
  expect(first).toMatchObject({ ok: false, needsConfirmation: true });
  expect(mocks.writeFile).not.toHaveBeenCalled();
  const confirmed = await writer.write("C:/code/app", files, { allowExisting: true });
  expect(confirmed.ok).toBe(true);
});

it("writes nothing during a setup preview, but reports the files it would make", async () => {
  localStorage.setItem("leonidas:setup-preview", '{"backup":null}');
  const result = await writer.write("C:/aios", files);
  localStorage.removeItem("leonidas:setup-preview");
  expect(result).toEqual({ ok: true, created: ["CLAUDE.md", "memory/README.md"], skipped: [] });
  expect(mocks.inspect).not.toHaveBeenCalled();
  expect(mocks.writeFile).not.toHaveBeenCalled();
});
