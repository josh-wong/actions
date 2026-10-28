"""Run the workflow's actual shell block against temporary local remotes."""

import os
import subprocess
import tempfile
import textwrap
import unittest
from pathlib import Path


class MirrorTests(unittest.TestCase):
    def run_git(self, repo, *args):
        return subprocess.check_output(["git", "-C", str(repo), *args], stderr=subprocess.DEVNULL, text=True).strip()

    def test_all_heads_tags_detached_checkout_and_atomic_divergence(self):
        workflow = (Path(__file__).parents[1] / ".github/workflows/mirror-to-gitlab.yaml").read_text()
        script = textwrap.dedent(workflow.split("        run: |\n", 1)[1])
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            source, target, checkout = [root / name for name in ["source", "target.git", "checkout"]]
            self.run_git(root, "init", "--initial-branch=main", str(source))
            self.run_git(source, "config", "user.name", "Test")
            self.run_git(source, "config", "user.email", "test@example.test")
            self.run_git(source, "commit", "--allow-empty", "-m", "Seed")
            self.run_git(source, "branch", "feature/test")
            self.run_git(source, "tag", "v1.0.0")
            self.run_git(root, "init", "--bare", str(target))
            self.run_git(root, "clone", str(source), str(checkout))
            self.run_git(checkout, "checkout", "--detach", "v1.0.0")
            script = script.replace("https://gitlab.com/josh-wong/actions.git", str(target))
            env = dict(os.environ, RUNNER_TEMP=temp, GITLAB_TOKEN="dummy-test-token")
            result = subprocess.run(["bash", "-c", script], cwd=checkout, env=env, capture_output=True)
            self.assertEqual(result.returncode, 0, result.stderr)
            for ref in ["refs/heads/main", "refs/heads/feature/test", "refs/tags/v1.0.0"]:
                self.assertEqual(self.run_git(target, "rev-parse", ref), self.run_git(source, "rev-parse", ref))
            self.assertNotIn("refs/heads/HEAD", self.run_git(target, "show-ref"))
            self.assertFalse((root / "gitlab-askpass").exists())
            # Advance only the destination, then advance an unrelated source ref.
            self.run_git(source, "checkout", "-b", "downstream-only")
            self.run_git(source, "commit", "--allow-empty", "-m", "Destination divergence")
            divergent = self.run_git(source, "rev-parse", "HEAD")
            self.run_git(source, "push", str(target), "HEAD:refs/heads/main", "HEAD:refs/heads/keep-me")
            self.run_git(source, "checkout", "feature/test")
            self.run_git(source, "commit", "--allow-empty", "-m", "New feature")
            feature_before = self.run_git(target, "rev-parse", "refs/heads/feature/test")
            result = subprocess.run(["bash", "-c", script], cwd=checkout, env=env, capture_output=True)
            self.assertNotEqual(result.returncode, 0)
            self.assertEqual(self.run_git(target, "rev-parse", "main"), divergent)
            self.assertEqual(self.run_git(target, "rev-parse", "feature/test"), feature_before)
            self.assertEqual(self.run_git(target, "rev-parse", "keep-me"), divergent)


if __name__ == "__main__":
    unittest.main()
