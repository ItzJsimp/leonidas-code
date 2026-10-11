import importlib.util
import json
import tempfile
import unittest
from pathlib import Path

MODULE = Path(__file__).resolve().parents[1] / ".agents/skills/next-action/scripts/resolve_tasks.py"
spec = importlib.util.spec_from_file_location("resolve_tasks", MODULE)
resolver = importlib.util.module_from_spec(spec)
spec.loader.exec_module(resolver)


class TaskDiscoveryTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.workspace = self.root / "aios"
        self.workspace.mkdir()

    def tasks(self, root):
        folder = root / "tasks"
        folder.mkdir(parents=True, exist_ok=True)
        return folder

    def test_first_discovery_saves_relative_cache_and_git_exclusion(self):
        folder = self.tasks(self.workspace)
        result = resolver.resolve(self.workspace)
        self.assertEqual(result["tasks_dir"], str(folder))
        self.assertEqual(result["source"], "discovered")
        data = json.loads((self.workspace / ".agents/next-action.json").read_text())
        self.assertEqual(data["tasks_dir"], "tasks")
        self.assertIn("next-action.json", (self.workspace / ".agents/.gitignore").read_text())

    def test_cached_store_wins_over_new_nearer_folder_without_rewrite(self):
        folder = self.tasks(self.workspace)
        project = self.workspace / "projects/demo"
        project.mkdir(parents=True)
        resolver.resolve(project)
        cache = project / ".agents/next-action.json"
        original_time = cache.stat().st_mtime_ns
        self.tasks(project)
        result = resolver.resolve(project)
        self.assertEqual(result["source"], "cache")
        self.assertEqual(result["tasks_dir"], str(folder))
        self.assertEqual(result["project"], "demo")
        self.assertEqual(cache.stat().st_mtime_ns, original_time)

    def test_stale_cache_recovers_and_explicit_override_is_persisted(self):
        old = self.tasks(self.workspace)
        resolver.resolve(self.workspace)
        old.rmdir()
        new = self.tasks(self.root)
        self.assertEqual(resolver.resolve(self.workspace)["tasks_dir"], str(new))
        custom = self.workspace / "work-items"
        custom.mkdir()
        result = resolver.resolve(self.workspace, "work-items")
        self.assertEqual(result["source"], "explicit")
        self.assertEqual(resolver.resolve(self.workspace)["tasks_dir"], str(custom))

    def test_generated_project_view_selects_canonical_store_and_filter(self):
        canonical = self.tasks(self.workspace)
        project = self.workspace / "projects/demo"
        view = self.tasks(project)
        (view / "README.md").write_text("A generated view of this project's task cards.")
        result = resolver.resolve(project)
        self.assertEqual(result["tasks_dir"], str(canonical))
        self.assertEqual(result["project"], "demo")
        self.assertIsNone(resolver.resolve(project, all_projects=True)["project"])
        self.assertEqual(resolver.resolve(project)["project"], "demo")

    def test_standalone_tasks_are_not_replaced_by_parent_tasks(self):
        self.tasks(self.workspace)
        project = self.workspace / "projects/demo"
        local = self.tasks(project)
        (local / "real-task.md").write_text("An independent project card")
        result = resolver.resolve(project)
        self.assertEqual(result["tasks_dir"], str(local))
        self.assertIsNone(result["project"])

    def test_malformed_cache_recovers_preserving_existing_ignore_rules(self):
        self.tasks(self.workspace)
        agents = self.workspace / ".agents"
        agents.mkdir()
        (agents / "next-action.json").write_text("{broken")
        (agents / ".gitignore").write_text("private.json")
        self.assertEqual(resolver.resolve(self.workspace)["status"], "found")
        self.assertEqual((agents / ".gitignore").read_text(), "private.json\nnext-action.json\n")

    def test_invalid_explicit_path_does_not_silently_fall_back(self):
        self.tasks(self.workspace)
        with self.assertRaises(ValueError):
            resolver.resolve(self.workspace, "missing")

    def test_missing_store_does_not_create_tasks_or_cache(self):
        result = resolver.resolve(self.workspace)
        self.assertEqual(result["status"], "not_found")
        self.assertFalse((self.workspace / "tasks").exists())
        self.assertFalse((self.workspace / ".agents/next-action.json").exists())


if __name__ == "__main__":
    unittest.main()
