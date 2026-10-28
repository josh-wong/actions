"""Fixture-only tests. No requests are made and no hosted issues are created."""

import copy
import io
import json
import os
import unittest
from contextlib import redirect_stdout
from pathlib import Path
from unittest.mock import patch
from urllib.error import HTTPError, URLError

import notify


SHA = "a" * 40
CONFIG = json.loads(Path(__file__).with_name("mappings.json").read_text())


class FakeApi:
    def __init__(self, host="github", lists=None, objects=None):
        self.host = host
        self.lists = lists or {}
        self.objects = objects or {}
        self.writes = []
        self.reads = []

    def pages(self, path, limit=None):
        self.reads.append(path)
        return self.lists.get(path, [])

    def call(self, path, data=None):
        if data is not None:
            self.writes.append((path, data))
            return {"id": 1}
        self.reads.append(path)
        return self.objects[path]


def github_fixture():
    event = {"repository": {"full_name": "josh-wong/actions", "default_branch": "main"},
             "ref": "refs/heads/main", "after": SHA}
    pr = {"number": 4, "merged_at": "2026-10-28T00:00:00Z", "body": "",
          "merge_commit_sha": SHA, "base": {"ref": "main"}}
    api = FakeApi(lists={f"/commits/{SHA}/pulls": [pr], "/pulls/4/files": [
        {"filename": "unmapped/new-name", "previous_filename": "auto-pr-script/old-name"}]})
    return api, event, pr




class MappingTests(unittest.TestCase):
    def test_only_mapped_files_select_counterparts(self):
        notify.validate_config(CONFIG)
        self.assertEqual(notify.select_mappings(CONFIG, "github", ["docs/unrelated.md"]), [])
        self.assertEqual([m["name"] for m in notify.select_mappings(CONFIG, "github", ["auto-pr-script/a"])], ["backports"])
        self.assertEqual([m["name"] for m in notify.select_mappings(CONFIG, "gitlab", ["gitlab/backport.py"])], ["backports"])

    def test_invalid_configuration_fails(self):
        config = copy.deepcopy(CONFIG)
        config["gitlab_project"] = "https://attacker.test/actions"
        with self.assertRaises(ValueError):
            notify.validate_config(config)

    def test_content_links_source_and_counterpart_without_copying_code(self):
        change = {"number": 4, "sha": SHA, "changed": {"auto-pr-script/file\n/assign @person"}}
        mappings = notify.select_mappings(CONFIG, "github", change["changed"])
        title, body, marker = notify.issue_content(CONFIG, "github", change, mappings)
        self.assertIn("after GitHub #4", title)
        self.assertIn("merged on GitHub", body)
        self.assertIn("https://github.com/josh-wong/actions/pull/4", body)
        self.assertIn("gitlab/backport.py", body)
        self.assertIn("Suggested: Sonnet | Review effort: low", body)
        self.assertIn(notify.SKIP_MARKER, body)
        self.assertNotIn("\n/assign", body)
        self.assertNotIn("@person", body)
        self.assertIn(marker, body)
        with self.assertRaises(ValueError):
            notify.issue_content(CONFIG, "github", dict(change, sha="bad"), mappings)


class MergeTests(unittest.TestCase):
    def test_github_merged_push_includes_renamed_old_path(self):
        api, event, pr = github_fixture()
        change = notify.github_change(api, event, CONFIG)
        self.assertIn("auto-pr-script/old-name", change["changed"])
        self.assertEqual(change["sha"], SHA)

    def test_github_unmerged_wrong_sha_and_direct_push_do_not_notify(self):
        for change in [{"merged_at": None}, {"merge_commit_sha": "b" * 40}]:
            api, event, pr = github_fixture()
            pr.update(change)
            self.assertIsNone(notify.github_change(api, event, CONFIG))
        api, event, pr = github_fixture()
        api.lists.clear()
        self.assertIsNone(notify.github_change(api, event, CONFIG))

    def test_github_non_default_deleted_or_other_project_is_ignored(self):
        for change in [{"ref": "refs/heads/feature"}, {"deleted": True},
                       {"repository": {"full_name": "someone/else", "default_branch": "main"}}]:
            api, event, pr = github_fixture()
            event.update(change)
            self.assertIsNone(notify.github_change(api, event, CONFIG))
            self.assertEqual(api.reads, [])



    def test_skip_marker_prevents_reverse_reminder(self):
        api, event, pr = github_fixture()
        pr["body"] = notify.SKIP_MARKER
        self.assertIsNone(notify.github_change(api, event, CONFIG))
        self.assertNotIn("/pulls/4/files", api.reads)



class DeliveryTests(unittest.TestCase):
    def test_both_destinations_create_correct_payload_and_skip_closed_duplicates(self):
        for host, field, path in [("github", "body", "/issues?state=all"),
                                  ("gitlab", "description", "/issues?state=all&scope=all")]:
            api = FakeApi(host)
            marker = "<!-- stable-marker -->"
            self.assertTrue(notify.send_reminder(api, "Review", marker, marker))
            self.assertEqual(api.writes[0], ("/issues", {"title": "Review", field: marker}))
            api.lists[path] = [{"state": "closed", field: marker}]
            self.assertFalse(notify.send_reminder(api, "Review", marker, marker))
            self.assertEqual(len(api.writes), 1)

    def test_github_pr_with_matching_text_is_not_a_reminder_issue(self):
        api = FakeApi(lists={"/issues?state=all": [{"body": "marker", "pull_request": {}}]})
        self.assertTrue(notify.send_reminder(api, "Review", "marker", "marker"))

    def test_retry_after_uncertain_post_checks_before_creating_again(self):
        api = FakeApi("gitlab")
        def lost_response(path, data):
            api.lists["/issues?state=all&scope=all"] = [{"description": data["description"]}]
            raise RuntimeError("Lost response after successful POST")
        with patch.object(api, "call", side_effect=lost_response):
            with self.assertRaises(RuntimeError):
                notify.send_reminder(api, "Review", "marker", "marker")
        self.assertFalse(notify.send_reminder(api, "Review", "marker", "marker"))
        self.assertEqual(api.writes, [])

    def test_api_pagination_and_limit(self):
        api = notify.Api("gitlab", "josh-wong/actions")
        with patch.object(api, "call", side_effect=[[{}] * 100, [{"id": 101}]]) as call:
            self.assertEqual(len(api.pages("/issues?scope=all")), 101)
            self.assertIn("page=2", call.call_args.args[0])
        with patch.object(api, "call", return_value=[{}] * 100):
            with self.assertRaisesRegex(RuntimeError, "pagination limit"):
                api.pages("/pulls/1/files", limit=100)

    def test_api_errors_do_not_log_credentials_or_response_bodies(self):
        api = notify.Api("github", "josh-wong/actions", "secret-value")
        for error in [HTTPError("https://secret-value@example.test", 403, "secret-value", {}, None),
                      URLError("secret-value")]:
            with patch("notify.build_opener") as opener:
                opener.return_value.open.side_effect = error
                with self.assertRaises(RuntimeError) as result:
                    api.call("/issues", {"title": "Review"})
                self.assertNotIn("secret-value", str(result.exception))
        self.assertIsNone(notify.NoRedirect().redirect_request(None, None, 302, None, None, "https://other.test"))

    def test_dry_run_never_requires_destination_token_or_writes(self):
        change = {"number": 4, "sha": SHA, "changed": {"auto-pr-script/file"}}
        event = Path(__file__).with_name("mappings.json")
        with patch.dict(os.environ, {"GITHUB_EVENT_PATH": str(event)}, clear=True), patch("sys.argv", ["notify.py", "github", "--dry-run"]), \
             patch("notify.github_change", return_value=change), patch("notify.send_reminder") as send, \
             redirect_stdout(io.StringIO()) as output:
            notify.main()
            self.assertIn("Counterpart files", output.getvalue())
            send.assert_not_called()

    def test_missing_token_fails_for_relevant_change_but_unrelated_change_skips(self):
        change = {"number": 1, "sha": SHA, "changed": {"auto-pr-script/file"}}
        event = Path(__file__).with_name("mappings.json")
        with patch.dict(os.environ, {"GITHUB_EVENT_PATH": str(event)}, clear=True), patch("sys.argv", ["notify.py", "github"]), \
             patch("notify.github_change", return_value=change), patch("notify.send_reminder") as send:
            with self.assertRaisesRegex(RuntimeError, "GITLAB_REMINDER_TOKEN"):
                notify.main()
            change["changed"] = {"docs/unrelated.md"}
            notify.main()
            send.assert_not_called()


if __name__ == "__main__":
    unittest.main()
