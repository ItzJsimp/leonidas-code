#!/usr/bin/env python3
"""Weekly Zero-Cost Research Literature Sweep for Leonidas AIOS.

Searches arXiv, Crossref, and Semantic Scholar for new preprints and papers
across key focus areas:
- AI safety & alignment
- Multi-agent coordination & architectures
- Autonomous agent memory systems
- Local LLM optimization & reasoning

Outputs:
1. Staged briefing in raw/reports/sweep-YYYY-MM-DD.md
2. Appended entries in raw/research-library/bibliographies/weekly-sweeps.md
"""

from __future__ import annotations

import datetime
import json
import os
import sys
from pathlib import Path

# Add script dir to sys.path to import deep_search
CURRENT_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(CURRENT_DIR))

try:
    from deep_search import search_arxiv, search_crossref, search_semantic_scholar
except ImportError:
    print("Error: Could not import deep_search modules", file=sys.stderr)
    sys.exit(1)

TOPICS = [
    ("AI Safety & Alignment", "AI safety alignment sandbox guardrails preprints"),
    ("Multi-Agent Frameworks", "multi-agent coordination orchestration framework LLM"),
    ("Agent Memory Systems", "agentic memory vector retrieval long-term memory LLM"),
    ("Reasoning & Local Models", "reasoning model distilled local inference optimization"),
]

def run_sweep() -> Path:
    today_str = datetime.date.today().isoformat()
    repo_root = CURRENT_DIR.parents[3] # d:\Leonidas AIOS
    reports_dir = repo_root / "raw" / "reports"
    library_dir = repo_root / "raw" / "research-library"
    bib_dir = library_dir / "bibliographies"

    reports_dir.mkdir(parents=True, exist_ok=True)
    bib_dir.mkdir(parents=True, exist_ok=True)

    report_path = reports_dir / f"sweep-{today_str}.md"
    bib_path = bib_dir / "weekly-sweeps.md"

    report_lines = [
        f"# Weekly Research Literature Sweep: {today_str}",
        "",
        "Autonomous zero-cost literature sweep across arXiv, Crossref, and Semantic Scholar.",
        f"**Date:** {today_str} | **Stack:** Open APIs (Zero Cost) | **Engine:** Leonidas Deep Research",
        "",
        "---",
        "",
    ]

    bib_entries = []

    for category, query in TOPICS:
        report_lines.append(f"## {category}")
        report_lines.append(f"*Query: `{query}`*")
        report_lines.append("")

        arxiv_results = search_arxiv(query, max_results=3)
        crossref_results = search_crossref(query, max_results=2)

        combined = arxiv_results + crossref_results
        valid_items = [item for item in combined if item.get("type") != "error"]

        if not valid_items:
            report_lines.append("- *No recent results found or API unreachable.*")
            report_lines.append("")
            continue

        for item in valid_items:
            title = item.get("title", "Untitled")
            authors = ", ".join(item.get("authors", [])) or "Unknown"
            date = item.get("date") or item.get("year", "Unknown")
            url = item.get("url", "")
            source = item.get("source", "Unknown")
            abstract = item.get("abstract", "")

            report_lines.append(f"### [{title}]({url})")
            report_lines.append(f"- **Authors:** {authors}")
            report_lines.append(f"- **Date/Source:** {date} ({source})")
            if abstract:
                report_lines.append(f"- **Abstract Summary:** {abstract}")
            report_lines.append("")

            # Prepare bibliography entry
            bib_entries.append(f"- **[{title}]({url})** - {authors} ({date}). Source: {source}")

        report_lines.append("---")
        report_lines.append("")

    report_lines.append("## Done when / Next Steps")
    report_lines.append("- [ ] Review staged papers above for relevance to Leonidas AIOS architecture.")
    report_lines.append("- [ ] Promote high-value findings into `raw/research-library/papers/` or `wiki/`.")
    report_lines.append("")

    # Write report
    report_path.write_text("\n".join(report_lines), encoding="utf-8")
    print(f"Staged report created at: {report_path}")

    # Append to bibliography
    if bib_entries:
        if not bib_path.exists():
            bib_header = "# Cumulative Weekly Sweeps Bibliography\n\nCurated literature references from automated weekly sweeps.\n\n"
            bib_path.write_text(bib_header, encoding="utf-8")

        with open(bib_path, "a", encoding="utf-8") as f:
            f.write(f"\n### Sweep: {today_str}\n\n")
            f.write("\n".join(bib_entries) + "\n")
        print(f"Appended {len(bib_entries)} entries to {bib_path}")

    return report_path

if __name__ == "__main__":
    run_sweep()
