import { describe, expect, it } from "@effect/vitest";
import * as HostProcess from "@t3tools/shared/HostProcess";
import { SpawnExecutableResolution } from "@t3tools/shared/shell";
import * as Effect from "effect/Effect";

import {
  ClaudeExecutableFileCheck,
  resolveClaudeSdkExecutablePath,
  resolveInstalledClaudeBinary,
  withClaudeUserBinOnPath,
} from "./ClaudeExecutable.ts";

const NPM_DIR = "C:\\Users\\dev\\AppData\\Roaming\\npm";
const NPM_SHIM = `${NPM_DIR}\\claude.cmd`;
const NPM_PACKAGE_EXE = `${NPM_DIR}\\node_modules\\@anthropic-ai\\claude-code\\bin\\claude.exe`;
const NPM_PACKAGE_CLI = `${NPM_DIR}\\node_modules\\@anthropic-ai\\claude-code\\cli.js`;

function withWindowsResolution(input: {
  readonly resolvedCommand: string | undefined;
  readonly existingFiles?: ReadonlyArray<string>;
}) {
  const existing = new Set(input.existingFiles ?? []);
  return <A, E, R>(effect: Effect.Effect<A, E, R>) =>
    effect.pipe(
      Effect.provideService(HostProcess.Platform, "win32"),
      Effect.provideService(SpawnExecutableResolution, () => input.resolvedCommand),
      Effect.provideService(ClaudeExecutableFileCheck, (filePath) => existing.has(filePath)),
    );
}

describe("resolveClaudeSdkExecutablePath", () => {
  it.effect("returns the configured path unchanged on non-Windows platforms", () =>
    Effect.gen(function* () {
      expect(
        yield* resolveClaudeSdkExecutablePath("claude", {}).pipe(
          Effect.provideService(HostProcess.Platform, "darwin"),
          Effect.provideService(SpawnExecutableResolution, () => {
            throw new Error("must not resolve on non-Windows platforms");
          }),
        ),
      ).toBe("claude");
    }),
  );

  it.effect("returns the resolved absolute path for native Windows executables", () =>
    Effect.gen(function* () {
      const nativeBinary = "C:\\Users\\dev\\.local\\bin\\claude.exe";
      expect(
        yield* resolveClaudeSdkExecutablePath("claude", {}).pipe(
          withWindowsResolution({ resolvedCommand: nativeBinary }),
        ),
      ).toBe(nativeBinary);
    }),
  );

  it.effect("follows an npm launcher shim to the packaged native binary", () =>
    Effect.gen(function* () {
      expect(
        yield* resolveClaudeSdkExecutablePath("claude", {}).pipe(
          withWindowsResolution({
            resolvedCommand: NPM_SHIM,
            existingFiles: [NPM_PACKAGE_EXE, NPM_PACKAGE_CLI],
          }),
        ),
      ).toBe(NPM_PACKAGE_EXE);
    }),
  );

  it.effect("follows .bat and .ps1 launcher shims the same way", () =>
    Effect.gen(function* () {
      for (const shim of [`${NPM_DIR}\\claude.bat`, `${NPM_DIR}\\claude.ps1`]) {
        expect(
          yield* resolveClaudeSdkExecutablePath("claude", {}).pipe(
            withWindowsResolution({
              resolvedCommand: shim,
              existingFiles: [NPM_PACKAGE_EXE],
            }),
          ),
        ).toBe(NPM_PACKAGE_EXE);
      }
    }),
  );

  it.effect("normalizes mixed-case shim extensions before matching", () =>
    Effect.gen(function* () {
      expect(
        yield* resolveClaudeSdkExecutablePath("claude", {}).pipe(
          withWindowsResolution({
            resolvedCommand: `${NPM_DIR}\\claude.CMD`,
            existingFiles: [NPM_PACKAGE_EXE],
          }),
        ),
      ).toBe(NPM_PACKAGE_EXE);
    }),
  );

  it.effect("falls back to cli.js when the package ships no native binary", () =>
    Effect.gen(function* () {
      expect(
        yield* resolveClaudeSdkExecutablePath("claude", {}).pipe(
          withWindowsResolution({
            resolvedCommand: NPM_SHIM,
            existingFiles: [NPM_PACKAGE_CLI],
          }),
        ),
      ).toBe(NPM_PACKAGE_CLI);
    }),
  );

  it.effect("returns the configured path when a shim has no known package entry", () =>
    Effect.gen(function* () {
      expect(
        yield* resolveClaudeSdkExecutablePath("claude", {}).pipe(
          withWindowsResolution({ resolvedCommand: NPM_SHIM }),
        ),
      ).toBe("claude");
    }),
  );

  it.effect("returns the configured path when command resolution finds nothing", () =>
    Effect.gen(function* () {
      expect(
        yield* resolveClaudeSdkExecutablePath("claude", {}).pipe(
          withWindowsResolution({ resolvedCommand: undefined }),
        ),
      ).toBe("claude");
    }),
  );
});

describe("withClaudeUserBinOnPath", () => {
  it("adds the install folder to the Windows Path key", () => {
    const next = withClaudeUserBinOnPath({ Path: "C:\\Windows" }, "C:\\Users\\gavin", "win32");
    expect(next.Path).toBe("C:\\Windows;C:\\Users\\gavin\\.local\\bin");
    expect(next.PATH).toBeUndefined();
  });

  it("keeps env unchanged when the folder is already on PATH", () => {
    const env = { PATH: "/usr/bin:/home/g/.local/bin/" };
    expect(withClaudeUserBinOnPath(env, "/home/g", "linux")).toBe(env);
  });

  it("matches Windows entries without case or trailing slash", () => {
    const env = { Path: "c:\\users\\gavin\\.local\\bin\\" };
    expect(withClaudeUserBinOnPath(env, "C:\\Users\\gavin", "win32")).toBe(env);
  });

  it("creates PATH when it is missing", () => {
    expect(withClaudeUserBinOnPath({}, "/home/g", "darwin").PATH).toBe("/home/g/.local/bin");
  });
});

describe("resolveInstalledClaudeBinary", () => {
  const installed = String.raw`C:\Users\dev\.local\bin\claude.exe`;
  const options = {
    home: String.raw`C:\Users\dev`,
    platform: "win32" as const,
    isFile: (filePath: string) => filePath === installed,
  };

  it("finds a Claude installed after the adapter started", () => {
    expect(resolveInstalledClaudeBinary("claude", options)).toBe(installed);
  });

  it("keeps a bare name when nothing is installed", () => {
    expect(resolveInstalledClaudeBinary("claude", { ...options, isFile: () => false })).toBe(
      "claude",
    );
  });

  it("never rewrites an explicit path or another command", () => {
    const explicit = String.raw`D:\tools\claude.exe`;
    expect(resolveInstalledClaudeBinary(explicit, options)).toBe(explicit);
    expect(resolveInstalledClaudeBinary("other", options)).toBe("other");
  });
});
