// @effect-diagnostics nodeBuiltinImport:off globalConsole:off - CI version planning runs before dependency installation, with Node built-ins only.
import * as NodeChildProcess from "node:child_process";
import * as NodeFS from "node:fs";
import * as NodeURL from "node:url";

export type ReleaseKind = "patch" | "minor" | "major" | "launch";
export interface ReleaseCommit {
  subject: string;
  body: string;
}

/** Features advance minor; breaking changes advance major only after public launch. */
export function classifyRelease(commits: ReadonlyArray<ReleaseCommit>): ReleaseKind {
  if (
    commits.some(
      ({ subject, body }) =>
        /^[a-z]+(?:\([^)]*\))?!:/.test(subject) || /^BREAKING CHANGE:/m.test(body),
    )
  )
    return "major";
  if (
    commits.some(({ subject }) => /^feat(?:\([^)]*\))?:/i.test(subject) || /^Build:/i.test(subject))
  )
    return "minor";
  return "patch";
}

export function nextReleaseVersion(
  previous: string,
  kind: ReleaseKind,
  development: boolean,
): string {
  if (!/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(previous))
    throw new Error("Expected a plain major.minor.patch version");
  const [major, minor, patch] = previous.split(".").map(Number) as [number, number, number];
  if (kind === "launch") {
    if (!development || major !== 0)
      throw new Error("Public launch must follow a 0.x development release");
    return "1.0.0";
  }
  if (development && major !== 0) throw new Error("Development releases must stay below 1.0.0");
  if (kind === "major") return development ? `0.${minor + 1}.0` : `${major + 1}.0.0`;
  if (kind === "minor") return `${major}.${minor + 1}.0`;
  return `${major}.${minor}.${patch + 1}`;
}

/** Keep release notes readable while retaining the complete change list. */
export function releaseNotes(
  commits: ReadonlyArray<ReleaseCommit>,
  version: string,
  development: boolean,
): string {
  const features: string[] = [],
    fixes: string[] = [],
    improvements: string[] = [];
  for (const { subject, body } of commits) {
    if (/^(?:docs|test|style|sync)(?:\(|:)/i.test(subject)) continue;
    const notes = [...body.matchAll(/^Release-Note:\s*(.+)$/gim)].map((match) => match[1]!.trim());
    const texts = notes.length ? notes : [subject.replace(/^[a-z]+(?:\([^)]*\))?!?:\s*/i, "")];
    const group =
      /^feat(?:\(|:)/i.test(subject) || /^Build:/i.test(subject)
        ? features
        : /^fix(?:\(|:)/i.test(subject)
          ? fixes
          : improvements;
    for (const text of texts) if (text && !group.includes(text)) group.push(text);
  }
  const sections = [
    ["New", features],
    ["Fixed", fixes],
    ["Improved", improvements],
  ] as const;
  return (
    `# ${version}${development ? " · Development" : ""}\n\n` +
    sections
      .filter(([, items]) => items.length)
      .map(([title, items]) => `## ${title}\n${items.map((item) => `- ${item}`).join("\n")}`)
      .join("\n\n") +
    (features.length + fixes.length + improvements.length ? "\n" : "- Maintenance improvements\n")
  );
}

function run(command: string, args: string[]): string {
  return NodeChildProcess.execFileSync(command, args, { encoding: "utf8" }).trim();
}

function main() {
  const repo = process.env.GITHUB_REPOSITORY;
  if (!repo) throw new Error("GITHUB_REPOSITORY is required");
  const config = JSON.parse(NodeFS.readFileSync("leonidas-release.json", "utf8")) as {
    stage: string;
    initialVersion: string;
  };
  if (!["development", "public"].includes(config.stage)) throw new Error("Unknown release stage");
  const development = config.stage === "development";
  const releases = JSON.parse(run("gh", ["api", `repos/${repo}/releases?per_page=100`])) as Array<{
    tag_name: string;
    draft: boolean;
    prerelease: boolean;
  }>;
  // Legacy 1.0.x builds predate the development policy. Never use those as the 0.x baseline.
  const previous = releases.find(
    (release) =>
      !release.draft &&
      !release.prerelease &&
      /^v\d+\.\d+\.\d+$/.test(release.tag_name) &&
      (!development || release.tag_name.startsWith("v0.")),
  );
  // The first 0.x release still describes changes since the last legacy install.
  const notesBaseline =
    previous ??
    releases.find(
      (release) =>
        !release.draft && !release.prerelease && /^v\d+\.\d+\.\d+$/.test(release.tag_name),
    );
  let range = "-1";
  if (notesBaseline) {
    run("git", [
      "fetch",
      "--no-tags",
      "origin",
      `refs/tags/${notesBaseline.tag_name}:refs/tags/${notesBaseline.tag_name}`,
    ]);
    // Fetch only main's history, instead of every upstream branch.
    if (run("git", ["rev-parse", "--is-shallow-repository"]) === "true")
      run("git", ["fetch", "--no-tags", "--unshallow", "origin", "main"]);
    if (
      run("git", ["merge-base", notesBaseline.tag_name, "HEAD"]) !==
      run("git", ["rev-list", "-1", notesBaseline.tag_name])
    )
      throw new Error("Previous release is not an ancestor of this build");
    range = `${notesBaseline.tag_name}..HEAD`;
  }
  const raw = run("git", ["log", range, "--no-merges", "--reverse", "--format=%s%x1f%b%x1e"]);
  const commits = raw
    .split("\x1e")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const [subject = "", body = ""] = entry.split("\x1f");
      return { subject, body };
    });
  const override = process.env.RELEASE_KIND;
  if (override && !["auto", "patch", "minor", "major", "launch"].includes(override))
    throw new Error("Unknown release kind");
  const kind =
    override && override !== "auto" ? (override as ReleaseKind) : classifyRelease(commits);
  const version = nextReleaseVersion(
    previous?.tag_name.slice(1) ?? config.initialVersion,
    kind,
    development,
  );
  NodeFS.writeFileSync(
    "notes.md",
    releaseNotes(commits, version, development && kind !== "launch"),
  );
  if (process.env.GITHUB_OUTPUT)
    NodeFS.appendFileSync(
      process.env.GITHUB_OUTPUT,
      `version=${version}\nprevious=${previous?.tag_name ?? ""}\n`,
    );
  console.log(
    `Release ${version} (${kind}); previous development release: ${previous?.tag_name ?? "none"}`,
  );
}

if (process.argv[1] && import.meta.url === NodeURL.pathToFileURL(process.argv[1]).href) main();
