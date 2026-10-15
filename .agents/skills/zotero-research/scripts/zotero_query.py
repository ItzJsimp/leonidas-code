#!/usr/bin/env python3
"""Deterministic local Zotero inspection tool for AIOS agents.

Safely queries local Zotero reference libraries read-only via:
1. Local Zotero HTTP API (http://127.0.0.1:23119/)
2. Local SQLite fallback (if Zotero desktop is closed but database exists)
"""

from __future__ import annotations

import argparse
import json
import os
import sqlite3
import sys
import urllib.error
import urllib.request
from pathlib import Path

ZOTERO_PORT = 23119
ZOTERO_BASE_URL = f"http://127.0.0.1:{ZOTERO_PORT}"


def check_zotero_http_alive() -> bool:
    """Check if Zotero local HTTP connector is active."""
    url = f"{ZOTERO_BASE_URL}/connector/ping"
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "AIOS-Zotero-Bridge/1.0"})
        with urllib.request.urlopen(req, timeout=1.5) as response:
            return response.status == 200
    except Exception:
        return False


def find_local_zotero_sqlite() -> Path | None:
    """Find default local Zotero SQLite database file."""
    user_home = Path.home()
    candidates = [
        user_home / "Zotero" / "zotero.sqlite",
        Path(os.environ.get("APPDATA", "")) / "Zotero" / "zotero.sqlite",
    ]
    for p in candidates:
        if p.exists():
            return p
    return None


def search_sqlite_library(db_path: Path, query: str, limit: int = 20) -> list[dict]:
    """Search items read-only directly in local SQLite database."""
    results = []
    try:
        # Open in URI read-only mode to prevent database locks or accidental modifications
        uri = f"file:{db_path.resolve().as_posix()}?mode=ro"
        conn = sqlite3.connect(uri, uri=True, timeout=3.0)
        cursor = conn.cursor()

        sql = """
        SELECT itemID, key, dateAdded, dateModified
        FROM items
        ORDER BY dateModified DESC
        LIMIT ?
        """
        cursor.execute(sql, (limit * 2,))
        items = cursor.fetchall()

        # Simple metadata lookup
        for item_id, key, date_added, date_modified in items:
            cursor.execute(
                """
                SELECT f.fieldName, v.value
                FROM itemData id
                JOIN fields f ON id.fieldID = f.fieldID
                JOIN itemDataValues v ON id.valueID = v.valueID
                WHERE id.itemID = ?
                """,
                (item_id,),
            )
            metadata = dict(cursor.fetchall())
            title = metadata.get("title", "")
            abstract = metadata.get("abstractNote", "")
            url = metadata.get("url", "")
            doi = metadata.get("DOI", "")

            # Filter by query
            q_lower = query.lower()
            if not query or q_lower in title.lower() or q_lower in abstract.lower():
                results.append({
                    "id": item_id,
                    "key": key,
                    "title": title,
                    "abstract": abstract[:300] + ("..." if len(abstract) > 300 else ""),
                    "url": url or (f"https://doi.org/{doi}" if doi else ""),
                    "date_added": date_added,
                    "date_modified": date_modified,
                })
                if len(results) >= limit:
                    break
        conn.close()
    except Exception as e:
        return [{"error": f"SQLite inspection failed: {e}"}]

    return results


def main() -> int:
    parser = argparse.ArgumentParser(description="Deterministic Zotero Read-Only Inspection Tool")
    parser.add_argument("query", nargs="?", default="", help="Search query (matches title and abstract)")
    parser.add_argument("--limit", type=int, default=10, help="Maximum results to return")
    parser.add_argument("--json", action="store_true", help="Output raw JSON")
    args = parser.parse_args()

    http_alive = check_zotero_http_alive()
    sqlite_path = find_local_zotero_sqlite()

    status = {
        "zotero_http_active": http_alive,
        "sqlite_found": sqlite_path is not None,
        "sqlite_path": str(sqlite_path) if sqlite_path else None,
        "results": [],
    }

    if not http_alive and not sqlite_path:
        status["diagnostic"] = (
            "Zotero is not currently active on this machine.\n"
            "1. To use live HTTP bridge: Open Zotero -> Settings -> Advanced -> Check 'Allow other applications on this computer to communicate with Zotero'.\n"
            "2. Default HTTP API is available on http://127.0.0.1:23119/.\n"
            "3. If using an alternative knowledge store, query the Obsidian LLM Wiki or open academic APIs directly."
        )
        if args.json:
            print(json.dumps(status, indent=2))
        else:
            print("[INFO] Zotero Local Bridge Status:")
            print("  HTTP API (127.0.0.1:23119): Inactive")
            print("  SQLite Database: Not found in standard paths (~/Zotero/zotero.sqlite)")
            print("\n" + status["diagnostic"])
        return 0

    if sqlite_path:
        status["results"] = search_sqlite_library(sqlite_path, args.query, limit=args.limit)

    if args.json:
        print(json.dumps(status, indent=2))
    else:
        print(f"[OK] Zotero Status: HTTP={http_alive} | SQLite={sqlite_path is not None}")
        print(f"Results for query: '{args.query}' (Found: {len(status['results'])}):")
        for idx, r in enumerate(status["results"], 1):
            print(f"\n[{idx}] {r.get('title', 'Untitled')}")
            if r.get("url"):
                print(f"    URL: {r['url']}")
            if r.get("abstract"):
                print(f"    Abstract: {r['abstract']}")

    return 0


if __name__ == "__main__":
    sys.exit(main())
