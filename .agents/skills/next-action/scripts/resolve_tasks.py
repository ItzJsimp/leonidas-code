"""Bounded task-store discovery with a workspace-local, relative-path cache."""
import argparse
import json
import os
import sys
from pathlib import Path


def project_slug(workspace, store_root):
    try:
        parts = workspace.relative_to(store_root).parts
    except ValueError:
        return None
    return parts[1] if len(parts) >= 2 and parts[0] == "projects" else None


def canonical_store(folder, workspace):
    # Generated project views have one write path in the parent AIOS.
    readme = folder / "README.md"
    is_view = readme.is_file() and "generated view" in readme.read_text(encoding="utf-8").lower()
    if is_view:
        for parent in workspace.parents:
            if (parent / "projects").is_dir() and (parent / "tasks").is_dir():
                return parent / "tasks"
    return folder


def resolve(workspace, tasks_dir=None, all_projects=False, save=True):
    workspace = Path(workspace).resolve()
    if not workspace.is_dir():
        raise ValueError("Workspace must be an existing directory")
    cache = workspace / ".agents" / "next-action.json"
    folder = None
    source = "discovered"
    if tasks_dir:
        folder = Path(tasks_dir)
        if not folder.is_absolute():
            folder = workspace / folder
        if not folder.is_dir():
            raise ValueError("Explicit task folder does not exist")
        source = "explicit"
    elif cache.is_file():
        try:
            data = json.loads(cache.read_text(encoding="utf-8"))
            cached = workspace / data["tasks_dir"]
            if cached.is_dir():
                folder = cached
                source = "cache"
        except (ValueError, KeyError, TypeError):
            pass
    if folder is None:
        for parent in (workspace, *workspace.parents):
            if parent == parent.parent:
                break
            candidate = parent / "tasks"
            if candidate.is_dir():
                folder = candidate
                break
    if folder is None:
        return {"status": "not_found", "workspace": str(workspace)}
    folder = folder.resolve() if source == "cache" else canonical_store(folder.resolve(), workspace).resolve()
    # Prove readability without scanning or loading every task.
    with os.scandir(folder) as entries:
        next(entries, None)
    payload = {"version": 1, "tasks_dir": os.path.relpath(folder, workspace).replace(os.sep, "/")}
    cache_error = None
    if save:
        try:
            cache.parent.mkdir(parents=True, exist_ok=True)
            ignore = cache.parent / ".gitignore"
            previous = ignore.read_text(encoding="utf-8") if ignore.exists() else ""
            if "next-action.json" not in previous.splitlines():
                with ignore.open("a", encoding="utf-8") as stream:
                    stream.write(("\n" if previous and not previous.endswith("\n") else "") + "next-action.json\n")
            # Avoid rewriting a valid cache on every invocation.
            content = json.dumps(payload, indent=2) + "\n"
            if not cache.exists() or cache.read_text(encoding="utf-8") != content:
                cache.write_text(content, encoding="utf-8")
        except OSError as error:
            cache_error = str(error)
    return {"status": "found", "tasks_dir": str(folder), "store_root": str(folder.parent),
            "project": None if all_projects else project_slug(workspace, folder.parent),
            "source": source, "cache_error": cache_error}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--workspace", default=".")
    parser.add_argument("--tasks-dir")
    parser.add_argument("--all-projects", action="store_true")
    args = parser.parse_args()
    try:
        result = resolve(args.workspace, args.tasks_dir, args.all_projects)
    except (OSError, ValueError) as error:
        print(json.dumps({"status": "error", "error": str(error)}))
        return 1
    print(json.dumps(result, indent=2))
    return 0 if result["status"] == "found" else 2


if __name__ == "__main__":
    sys.exit(main())
