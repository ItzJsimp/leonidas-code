// Free Ponytail gauge: median changed lines per commit of non-test .ts/.tsx files, by ISO week.
// Usage: node scripts/ponytail-commit-size.mjs [author] [sinceDate]
// A drop after Ponytail started fits its claim, but task mix also moves this number.
import { execFileSync } from "node:child_process";

const author = process.argv[2] ?? "";
const since = process.argv[3] ?? "2026-09-01";
const log = execFileSync(
  "git",
  [
    "log",
    `--since=${since}`,
    "--no-merges",
    ...(author ? [`--author=${author}`] : []),
    "--format=@@%ad",
    "--date=format:%G-W%V",
    "--numstat",
    "--",
    "*.ts",
    "*.tsx",
    ":!*.test.*",
  ],
  { encoding: "utf8", maxBuffer: 1 << 28 },
);

const weeks = new Map();
let commit;
for (const line of log.split("\n")) {
  if (line.startsWith("@@")) {
    commit = { week: line.slice(2), lines: 0 };
    weeks.set(commit, commit);
  } else if (commit && line.includes("\t")) {
    const [added, deleted] = line.split("\t");
    if (added !== "-") commit.lines += Number(added) + Number(deleted);
  }
}

const byWeek = new Map();
for (const { week, lines } of weeks.keys()) {
  if (lines > 0) byWeek.set(week, [...(byWeek.get(week) ?? []), lines]);
}
for (const week of [...byWeek.keys()].toSorted()) {
  const sizes = byWeek.get(week).toSorted((a, b) => a - b);
  const pct = (p) => sizes[Math.min(sizes.length - 1, Math.floor(sizes.length * p))];
  console.log(
    `${week}  commits ${String(sizes.length).padStart(4)}  median ${pct(0.5)}  p75 ${pct(0.75)}`,
  );
}
