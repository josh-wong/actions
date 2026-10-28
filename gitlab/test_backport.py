"""Deterministic backport checks against local repositories; no hosted writes."""

import subprocess
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import backport


class TargetTests(unittest.TestCase):
    def test_labels_and_milestone_preserve_old_mapping(self):
        for version, expected in [("2.0.0", "main"), ("1.3.0", "1"), ("1.2.3", "1.2")]:
            mr = {"target_branch": "2", "milestone": {"title": "Example " + version},
                  "labels": ["backport::1", "backport::2", "unrelated"]}
            self.assertEqual(backport.targets(mr, "main", "Example"), sorted({"1", expected}))

    def test_invalid_target_fails_and_unrelated_milestone_is_ignored(self):
        mr = {"target_branch": "main", "milestone": {"title": "Other 1.2.3"}}
        self.assertEqual(backport.targets(mr, "main", "Example"), [])
        for label in ["backport::", "backport::--all", "backport::feature/test", "backport::1.2.3"]:
            with self.assertRaises(ValueError):
                backport.targets(dict(mr, labels=[label]), "main", "Example")

    def test_only_exact_completed_merge_is_selected(self):
        mr = {"state": "merged", "target_branch": "main", "source_branch": "fix/example",
              "merge_commit_sha": "merge", "squash_commit_sha": "squash", "sha": "head"}
        self.assertTrue(backport.merged_here(mr, "merge", "main"))
        for sha in ["squash", "head", "other"]:
            self.assertFalse(backport.merged_here(mr, sha, "main"))
        self.assertFalse(backport.merged_here(dict(mr, state="opened"), "merge", "main"))
        self.assertFalse(backport.merged_here(mr, "merge", "1"))
        self.assertFalse(backport.merged_here(dict(mr, source_branch="backport/1/main"), "merge", "main"))
        self.assertTrue(backport.merged_here(dict(mr, merge_commit_sha=None), "squash", "main"))
        self.assertTrue(backport.merged_here(dict(mr, merge_commit_sha=None, squash_commit_sha=None), "head", "main"))


class FakeApi:
    def __init__(self, commits=None):
        self.commits = commits or []
        self.created = []
        self.existing = []

    def pages(self, path):
        return self.commits if path.endswith("/commits") else self.existing

    def call(self, path, data=None):
        if path.startswith("/members/"):
            return {"state": "active", "access_level": 30}
        self.created.append(data)
        return {"iid": 20}


class GitTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.origin = self.root / "origin.git"
        self.work = self.root / "work"
        self.run_git(self.root, "init", "--bare", str(self.origin))
        self.run_git(self.root, "clone", str(self.origin), str(self.work))
        self.run_git(self.work, "config", "user.name", "Test Author")
        self.run_git(self.work, "config", "user.email", "author@example.test")
        self.run_git(self.work, "checkout", "-b", "main")
        self.commit("base")
        self.run_git(self.work, "branch", "1")
        self.run_git(self.work, "branch", "2")
        self.run_git(self.work, "push", "origin", "main", "1", "2")
        self.mr = {"iid": 3, "web_url": "https://example.test/project/-/merge_requests/3",
                   "title": "Fix $() and `quoted` text", "author": {"id": 1},
                   "target_branch": "main"}

    def run_git(self, repo, *args):
        result = subprocess.run(["git", "-C", str(repo), *args], capture_output=True, text=True)
        if result.returncode:
            self.fail(result.stderr)
        return result.stdout.strip()

    def commit(self, text):
        (self.work / "example").write_text(text + "\n")
        self.run_git(self.work, "add", "example")
        self.run_git(self.work, "commit", "-m", "Update example")
        return self.run_git(self.work, "rev-parse", "HEAD")

    def test_squash_backport_pushes_change_and_retry_reuses_branch(self):
        sha = self.commit("fix")
        mr = dict(self.mr, squash_commit_sha=sha)
        api = FakeApi()
        backport.backport(api, self.work, mr, "1")
        branch = "backport/3/1"
        self.assertEqual(self.run_git(self.origin, "show", branch + ":example"), "fix")
        self.assertEqual(api.created[0]["source_branch"], branch)
        self.assertEqual(api.created[0]["title"], "Backport to 1: " + mr["title"])
        self.assertEqual(api.created[0]["assignee_id"], 1)
        before = self.run_git(self.origin, "rev-parse", branch)
        # Simulate a new runner after a push succeeded but MR creation failed.
        self.run_git(self.work, "fetch", "origin")
        backport.backport(api, self.work, mr, "1")
        self.assertEqual(self.run_git(self.origin, "rev-parse", branch), before)
        api.existing = [{"state": "closed"}]
        backport.backport(api, self.work, mr, "1")
        self.assertEqual(len(api.created), 2)

    def test_merge_commit_applies_all_mr_changes(self):
        self.run_git(self.work, "checkout", "-b", "feature")
        self.commit("first")
        self.commit("second")
        self.run_git(self.work, "checkout", "main")
        self.run_git(self.work, "merge", "--no-ff", "feature", "-m", "Merge feature")
        sha = self.run_git(self.work, "rev-parse", "HEAD")
        backport.backport(FakeApi(), self.work, dict(self.mr, merge_commit_sha=sha), "1")
        self.assertEqual(self.run_git(self.origin, "show", "backport/3/1:example"), "second")

    def test_fast_forward_applies_commits_in_order(self):
        first = self.commit("first")
        second = self.commit("second")
        api = FakeApi([{"id": second}, {"id": first}])
        backport.backport(api, self.work, dict(self.mr, sha=second), "1")
        self.assertEqual(self.run_git(self.origin, "show", "backport/3/1:example"), "second")

    def test_fast_forward_tip_in_merge_sha_still_applies_all_commits(self):
        first = self.commit("first")
        second = self.commit("second")
        api = FakeApi([{"id": second}, {"id": first}])
        backport.backport(api, self.work, dict(self.mr, sha=second, merge_commit_sha=second), "1")
        self.assertFalse(api.created[0]["title"].startswith("Draft:"))
        self.assertEqual(self.run_git(self.origin, "show", "backport/3/1:example"), "second")

    def test_conflict_creates_empty_draft_and_next_target_succeeds(self):
        sha = self.commit("fix")
        self.run_git(self.work, "checkout", "1")
        self.commit("conflicting change")
        self.run_git(self.work, "push", "origin", "1")
        self.run_git(self.work, "fetch", "origin")
        api = FakeApi()
        mr = dict(self.mr, squash_commit_sha=sha)
        backport.backport(api, self.work, mr, "1")
        self.assertTrue(api.created[0]["title"].startswith("Draft: "))
        self.assertEqual(self.run_git(self.origin, "diff", "1", "backport/3/1"), "")
        backport.backport(api, self.work, mr, "2")
        self.assertEqual(self.run_git(self.origin, "show", "backport/3/2:example"), "fix")

    def test_existing_unrelated_branch_is_never_overwritten(self):
        self.run_git(self.work, "push", "origin", "main:refs/heads/backport/3/1")
        self.run_git(self.work, "fetch", "origin")
        before = self.run_git(self.origin, "rev-parse", "backport/3/1")
        with self.assertRaisesRegex(RuntimeError, "provenance"):
            backport.backport(FakeApi(), self.work, dict(self.mr, squash_commit_sha=self.commit("fix")), "1")
        self.assertEqual(self.run_git(self.origin, "rev-parse", "backport/3/1"), before)

    def test_missing_target_fails_without_mr(self):
        api = FakeApi()
        with self.assertRaises(RuntimeError):
            backport.backport(api, self.work, self.mr, "99")
        self.assertEqual(api.created, [])


class ApiTests(unittest.TestCase):
    def test_pagination_reads_beyond_first_page(self):
        api = backport.Api("https://example.test/api/v4", "group/project", "not-a-token")
        with patch.object(api, "call", side_effect=[[{}] * 100, [{"iid": 101}]]) as call:
            self.assertEqual(len(api.pages("/merge_requests?state=all")), 101)
            self.assertIn("page=2", call.call_args.args[0])

    def test_assignee_falls_back_to_merger(self):
        api = FakeApi()
        with patch.object(api, "call", side_effect=[backport.ApiError(404), {"state": "active", "access_level": 40}]):
            self.assertEqual(backport.assignee(api, {"author": {"id": 1}, "merge_user": {"id": 2}}), 2)


if __name__ == "__main__":
    unittest.main()
