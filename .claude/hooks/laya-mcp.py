"""Thin Laya MCP launcher. Safe to commit in any project.

Runs the per-user pack (~/.leonidas/laya/mcp_server.py) when it is installed.
Without the pack it exits 0 at once, so the server shows as not connected and nothing else breaks.
"""
import os
import runpy
import sys


def main():
    pack = os.environ.get("LAYA_PACK_DIR") or os.path.join(os.path.expanduser("~"), ".leonidas", "laya")
    script = os.path.join(pack, "mcp_server.py")
    if not os.path.isfile(script):
        sys.exit(0)
    runpy.run_path(script, run_name="__main__")


main()
