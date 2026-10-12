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

    def test_detect_project_context_standalone_leonidas_code(self):
        standalone = self.root / "standalone-code"
        standalone.mkdir()
        (standalone / "leonidas-release.json").write_text('{"stage": "development"}')
        detected = resolver.detect_project_context(standalone)
        self.assertEqual(detected, "leonidas-code")

    def test_rank_tasks_filters_and_scores_for_user_and_energy(self):
        folder = self.tasks(self.workspace)
        task1 = folder / "task-mob-win.md"
        task1.write_text("""---
name: "Quick win for Mob"
priority: "High"
energy_type: "Quick Win"
effort: "Low"
lane: "mob"
status: "Ready"
---
## Why
Essential quick polish.
""")
        task2 = folder / "task-jake-deep.md"
        task2.write_text("""---
name: "Deep Architecture for Jake"
priority: "High"
energy_type: "Deep Work"
effort: "High"
lane: "jake"
status: "Ready"
---
## Why
Large architectural redesign.
""")
        result_mob = resolver.resolve(self.workspace, rank=True, user="mob", energy="low")
        self.assertTrue(len(result_mob["tasks"]) >= 1)
        self.assertEqual(result_mob["tasks"][0]["name"], "Quick win for Mob")
        self.assertEqual(result_mob["tasks"][0]["route"]["route"], "in-chat")

        result_jake = resolver.resolve(self.workspace, rank=True, user="jake", energy="high")
        self.assertTrue(len(result_jake["tasks"]) >= 1)
        self.assertEqual(result_jake["tasks"][0]["name"], "Deep Architecture for Jake")
        self.assertEqual(result_jake["tasks"][0]["route"]["route"], "prompt-composer")

    def test_project_without_matches_never_returns_other_backlog(self):
        folder = self.tasks(self.workspace)
        (folder / "other.md").write_text('---\nname: Other\nproject: another\nstatus: Ready\n---\n')
        result = resolver.resolve(self.workspace, rank=True, project="leonidas-code", save=False)
        self.assertEqual(result["tasks"], [])

    def test_standalone_untagged_task_is_local_but_conflicting_tag_is_not(self):
        folder = self.tasks(self.workspace)
        (self.workspace / "leonidas-release.json").write_text('{}')
        (folder / "local.md").write_text('---\nname: Local\nstatus: Ready\n---\n')
        (folder / "leonidas-code-other.md").write_text('---\nname: Other\nproject: another\nstatus: Ready\n---\n')
        result = resolver.resolve(self.workspace, rank=True, save=False)
        self.assertEqual([t["name"] for t in result["tasks"]], ["Local"])

    def test_blocked_unknown_and_other_owner_are_excluded(self):
        folder = self.tasks(self.workspace)
        for name, fields in {"blocked": "status: Blocked", "unknown": "", "jake": "status: Ready\nlane: jake"}.items():
            (folder / (name + ".md")).write_text('---\nname: ' + name + '\n' + fields + '\n---\n')
        result = resolver.resolve(self.workspace, rank=True, user="mob", save=False)
        self.assertEqual(result["tasks"], [])

    def test_autonomous_title_does_not_prove_delegation_readiness(self):
        task = {"name": "Verify settings parity", "effort": "Low", "energy_type": "Quick Win", "autonomous": True}
        self.assertEqual(resolver.assign_execution_route(task)["route"], "in-chat")

    def test_draft_prompt_composer_format(self):
        task = {
            "name": "Implement Widget",
            "why": "Provide better user feedback",
            "start_here": "src/widget.ts",
            "done_when": "- [ ] Widget renders correctly",
            "path": "tasks/widget.md"
        }
        prompt = resolver.draft_prompt_composer(task, "leonidas-code")
        self.assertIn("<task>", prompt)
        self.assertIn("Implement Widget", prompt)
        self.assertIn("<context>", prompt)
        self.assertIn("<rules>", prompt)
        self.assertIn("<verification>", prompt)


if __name__ == "__main__":
    unittest.main()
