"""Thin Laya bash gate launcher. Safe to commit in any project.

Runs the per-user pack (~/.leonidas/laya/bash_gate_hook.py) when it is installed.
Without the pack it does nothing: exit 0 and no output, so a missing install never blocks a tool call.
"""
import os
import runpy


def main():
    try:
        pack = os.environ.get("LAYA_PACK_DIR") or os.path.join(os.path.expanduser("~"), ".leonidas", "laya")
        script = os.path.join(pack, "bash_gate_hook.py")
        if os.path.isfile(script):
            runpy.run_path(script, run_name="__main__")
    except BaseException:  # a broken pack must never brick a session
        pass


main()
