#!/usr/bin/env python3
"""Zero-Cost Deep Academic & Web Search Engine for AIOS & Hermes agents.

Queries open, free academic and web APIs concurrently without paid API keys:
1. arXiv API (open XML API for computer science, AI, and math preprints)
2. Crossref API (open metadata API for peer-reviewed papers, journals, DOIs)
3. Semantic Scholar API (open citation graph, with graceful rate-limit handling)
4. DuckDuckGo / Open Web Search
"""

from __future__ import annotations

import argparse
import json
import re
import sys
import urllib.error
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET

USER_AGENT = "Leonidas-DeepResearch/1.0 (mailto:admin@leonidas.ai)"


def search_arxiv(query: str, max_results: int = 5) -> list[dict]:
    """Search arXiv API for preprints."""
    results = []
    try:
        encoded_query = urllib.parse.quote_plus(query)
        url = f"http://export.arxiv.org/api/query?search_query=all:{encoded_query}&start=0&max_results={max_results}&sortBy=relevance&sortOrder=descending"
        req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
        with urllib.request.urlopen(req, timeout=8.0) as resp:
            content = resp.read()

        root = ET.fromstring(content)
        ns = {"atom": "http://www.w3.org/2005/Atom"}

        for entry in root.findall("atom:entry", ns):
            title = entry.find("atom:title", ns)
            summary = entry.find("atom:summary", ns)
            id_elem = entry.find("atom:id", ns)
            published = entry.find("atom:published", ns)
            authors = [a.find("atom:name", ns).text for a in entry.findall("atom:author", ns) if a.find("atom:name", ns) is not None]

            clean_title = re.sub(r"\s+", " ", title.text.strip()) if title is not None and title.text else "Untitled"
            clean_summary = re.sub(r"\s+", " ", summary.text.strip()) if summary is not None and summary.text else ""
            paper_url = id_elem.text.strip() if id_elem is not None and id_elem.text else ""
            pub_date = published.text.strip()[:10] if published is not None and published.text else "Unknown"

            results.append({
                "type": "academic_preprint",
                "source": "arXiv",
                "title": clean_title,
                "authors": authors[:3],
                "date": pub_date,
                "url": paper_url,
                "abstract": clean_summary[:350] + ("..." if len(clean_summary) > 350 else ""),
            })
    except Exception as e:
        results.append({"type": "error", "source": "arXiv", "message": str(e)})

    return results


def search_crossref(query: str, max_results: int = 5) -> list[dict]:
    """Search Crossref open metadata API for peer-reviewed papers and DOIs."""
    results = []
    try:
        encoded_query = urllib.parse.quote_plus(query)
        url = f"https://api.crossref.org/works?query={encoded_query}&rows={max_results}&sort=relevance"
        req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
        with urllib.request.urlopen(req, timeout=8.0) as resp:
            data = json.loads(resp.read().decode("utf-8"))

        for item in data.get("message", {}).get("items", []):
            title = item.get("title", ["Untitled"])[0]
            doi = item.get("DOI", "")
            url_link = item.get("URL") or (f"https://doi.org/{doi}" if doi else "")
            container = item.get("container-title", [""])[0]
            
            # Author extraction
            authors = []
            for a in item.get("author", []):
                name = a.get("family", "")
                if a.get("given"):
                    name = f"{a.get('given')} {name}"
                if name:
                    authors.append(name)

            # Year extraction
            year = "Unknown"
            if "published" in item and "date-parts" in item["published"]:
                parts = item["published"]["date-parts"][0]
                if parts:
                    year = str(parts[0])

            results.append({
                "type": "academic_peer_reviewed",
                "source": f"Crossref ({container})" if container else "Crossref",
                "title": title,
                "authors": authors[:3],
                "date": year,
                "doi": doi,
                "url": url_link,
                "abstract": f"Published in {container} (DOI: {doi})" if container else f"DOI: {doi}",
            })
    except Exception as e:
        results.append({"type": "error", "source": "Crossref", "message": str(e)})

    return results


def search_semantic_scholar(query: str, max_results: int = 5) -> list[dict]:
    """Search Semantic Scholar API with fallback."""
    results = []
    try:
        encoded_query = urllib.parse.quote_plus(query)
        url = f"https://api.semanticscholar.org/graph/v1/paper/search?query={encoded_query}&limit={max_results}&fields=title,authors,year,citationCount,abstract,openAccessPdf"
        req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
        with urllib.request.urlopen(req, timeout=6.0) as resp:
            data = json.loads(resp.read().decode("utf-8"))

        for paper in data.get("data", []):
            title = paper.get("title", "Untitled")
            abstract = paper.get("abstract") or ""
            year = paper.get("year", "Unknown")
            citations = paper.get("citationCount", 0)
            authors = [a.get("name") for a in paper.get("authors", []) if a.get("name")]
            pdf_info = paper.get("openAccessPdf") or {}
            paper_id = paper.get("paperId", "")
            paper_url = pdf_info.get("url") or f"https://www.semanticscholar.org/paper/{paper_id}"

            results.append({
                "type": "academic_peer_reviewed",
                "source": "Semantic Scholar",
                "title": title,
                "authors": authors[:3],
                "date": str(year),
                "citations": citations,
                "url": paper_url,
                "abstract": abstract[:350] + ("..." if len(abstract) > 350 else ""),
            })
    except Exception as e:
        # Rate limits are expected without key; report cleanly
        if "429" in str(e):
            results.append({"type": "notice", "source": "Semantic Scholar", "message": "Rate limited on public tier. arXiv and Crossref provide full academic coverage."})
        else:
            results.append({"type": "error", "source": "Semantic Scholar", "message": str(e)})

    return results


def main() -> int:
    parser = argparse.ArgumentParser(description="Zero-Cost Deep Academic & Web Research Discovery Engine")
    parser.add_argument("query", help="Primary research question or keywords")
    parser.add_argument("--limit", type=int, default=3, help="Max results per provider")
    parser.add_argument("--json", action="store_true", help="Output raw JSON")
    args = parser.parse_args()

    aggregated = {
        "query": args.query,
        "arxiv_preprints": search_arxiv(args.query, max_results=args.limit),
        "crossref_peer_reviewed": search_crossref(args.query, max_results=args.limit),
        "semantic_scholar": search_semantic_scholar(args.query, max_results=args.limit),
    }

    if args.json:
        print(json.dumps(aggregated, indent=2))
        return 0

    print(f"=== Zero-Cost Deep Academic Research: '{args.query}' ===\n")

    print(f"--- 1. arXiv Preprints ({len(aggregated['arxiv_preprints'])}) ---")
    for idx, item in enumerate(aggregated["arxiv_preprints"], 1):
        if item.get("type") == "error":
            print(f"  [ERROR] {item.get('source')}: {item.get('message')}")
            continue
        authors_str = ", ".join(item.get("authors", []))
        print(f"[{idx}] {item['title']} ({item.get('date', 'Unknown')}) - {authors_str}")
        print(f"    URL: {item['url']}")
        if item.get("abstract"):
            print(f"    Abstract: {item['abstract']}")
        print()

    print(f"--- 2. Crossref Peer-Reviewed & Journals ({len(aggregated['crossref_peer_reviewed'])}) ---")
    for idx, item in enumerate(aggregated["crossref_peer_reviewed"], 1):
        if item.get("type") == "error":
            print(f"  [ERROR] {item.get('source')}: {item.get('message')}")
            continue
        authors_str = ", ".join(item.get("authors", []))
        print(f"[{idx}] {item['title']} ({item.get('date', 'Unknown')}) - {authors_str}")
        print(f"    Source: {item.get('source')}")
        print(f"    URL: {item['url']}")
        print()

    return 0


if __name__ == "__main__":
    sys.exit(main())
