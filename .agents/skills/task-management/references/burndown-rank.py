"""Rank the next burndown batch: open lane-leonidas cards, smallest first (effort, then open-gate count).
Skips cards that mention Scribe, Command Center, Hermes, voice, Laya or other live-session areas.
Run: python .agents/skills/task-management/references/burndown-rank.py   (prints count, then the top 20)
"""
import re, glob, os
os.chdir(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "..", ".."))
eff = {"Low": 0, "Medium": 1, "High": 2}
skip = re.compile(r"scribe|command center|command-center|hermes|voice|idea injector|skills tab|finance-sync|cockpit|laya|kokoro|fish", re.I)
rows = []
for p in glob.glob("tasks/*.md"):
    t = open(p, encoding="utf-8").read()
    m = re.match(r"---\n(.*?)\n---\n(.*)", t.replace("\r\n", "\n"), re.S)
    if not m:
        continue
    fm = dict(re.findall(r'^(\w+):\s*"?(.*?)"?\s*$', m.group(1), re.M))
    if fm.get("type") != "task" or fm.get("lane") != "leonidas":
        continue
    if fm.get("status") in ("Done", "Blocked", "Retired", "Awaiting Review"):
        continue
    if skip.search(t) or skip.search(fm.get("project", "")):
        continue
    gates = len(re.findall(r"^- \[ \]", t, re.M))
    rows.append((eff.get(fm.get("effort"), 1), gates, os.path.basename(p), fm.get("status"), fm.get("scope")))
rows.sort()
print(len(rows))
for r in rows[:20]:
    print(r)
