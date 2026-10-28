"""Create reviewed GitLab backports after a merge, using only the standard library."""

import json
import os
import re
import subprocess
import tempfile
from pathlib import Path
from urllib.error import HTTPError
from urllib.parse import quote, urlencode
from urllib.request import Request, urlopen


VERSION_BRANCH = re.compile(r"[0-9]+(?:\.[0-9]+)?")


def eligible_branch(branch, default):
    return branch == default or VERSION_BRANCH.fullmatch(branch) is not None


def targets(mr, default, project_name):
    result = set()
    for label in mr.get("labels", []):
        if label.startswith("backport::"):
            branch = label.removeprefix("backport::")
            if not eligible_branch(branch, default):
                raise ValueError("Unsupported backport target label")
            result.add(branch)
    milestone = mr.get("milestone") or {}
    version = re.fullmatch(re.escape(project_name) + r" ([0-9]+)\.([0-9]+)\.([0-9]+)",
                           milestone.get("title", ""))
    if version:
        major, minor, patch = version.groups()
        result.add(default if int(minor) == 0 and int(patch) == 0
                   else major if int(patch) == 0 else f"{major}.{minor}")
    return sorted(result - {mr["target_branch"]})


def merged_here(mr, sha, branch):
    # Associated MRs can include earlier merges and cherry-picks. Only accept
    # the exact commit that completed this merge into this pipeline's branch.
    return (mr.get("state") == "merged" and mr.get("target_branch") == branch
            and not mr.get("source_branch", "").startswith("backport/")
            and sha == (mr.get("merge_commit_sha") or mr.get("squash_commit_sha") or mr.get("sha")))


class ApiError(RuntimeError):
    def __init__(self, status):
        self.status = status
        super().__init__(f"GitLab API request failed (HTTP {status})")


class Api:
    def __init__(self, base, project, token):
        self.base = f"{base}/projects/{quote(project, safe='')}"
        self.token = token

    def call(self, path, data=None):
        request = Request(self.base + path, headers={"PRIVATE-TOKEN": self.token,
                          "Content-Type": "application/json"},
                          data=None if data is None else json.dumps(data).encode())
        try:
            with urlopen(request, timeout=60) as response:
                return json.load(response)
        except HTTPError as error:
            # Never print server bodies, request headers, or credentialed URLs.
            raise ApiError(error.code) from None

    def pages(self, path):
        result = []
        for page in range(1, 1001):
            batch = self.call(path + ("&" if "?" in path else "?") + urlencode({"per_page": 100, "page": page}))
            result.extend(batch)
            if len(batch) < 100:
                return result
        raise RuntimeError("GitLab API pagination limit exceeded")


def git(repo, *args, check=True, env=None):
    result = subprocess.run(["git", "-C", str(repo), *args], text=True,
                            capture_output=True, env=env)
    if check and result.returncode:
        raise RuntimeError(f"Git operation failed: {args[0]}")
    return result


def commits_to_pick(api, repo, mr):
    if mr.get("merge_commit_sha"):
        sha = mr["merge_commit_sha"]
        if len(git(repo, "show", "-s", "--format=%P", sha).stdout.split()) > 1:
            return [(sha, True)]
        # GitLab can identify the fast-forward tip as merge_commit_sha. Its
        # last commit alone does not contain all changes from an unsquashed MR.
    if mr.get("squash_commit_sha"):
        return [(mr["squash_commit_sha"], False)]
    commits = {commit["id"] for commit in api.pages(f"/merge_requests/{mr['iid']}/commits")}
    ordered = git(repo, "rev-list", "--reverse", "--topo-order", mr["sha"]).stdout.splitlines()
    return [(sha, False) for sha in ordered if sha in commits]


def prepare_branch(api, repo, mr, target, branch):
    marker = f"Backport-of: {mr['web_url']}"
    remote = git(repo, "rev-parse", "--verify", f"refs/remotes/origin/{branch}", check=False)
    if remote.returncode == 0:
        # Recover a push followed by an API failure without changing the branch.
        message = git(repo, "show", "-s", "--format=%B", remote.stdout.strip()).stdout
        if marker not in message.splitlines():
            raise RuntimeError("Existing backport branch has no matching provenance")
        return "Backport-conflict: yes" in message.splitlines()

    git(repo, "checkout", "-b", branch, f"refs/remotes/origin/{target}")
    picks = commits_to_pick(api, repo, mr)
    if not picks:
        raise RuntimeError("Merged MR has no commits to backport")
    conflict = False
    for sha, merge in picks:
        # Unexpected nested merges in a fast-forward MR require manual review.
        parents = git(repo, "show", "-s", "--format=%P", sha).stdout.split()
        if len(parents) > 1 and not merge:
            conflict = True
            break
        args = ["cherry-pick", "--no-rerere-autoupdate", "-x"]
        if merge and len(parents) > 1:
            args.extend(["-m", "1"])
        result = git(repo, *args, sha, check=False)
        if result.returncode:
            # Empty picks also need review: don't silently claim a backport.
            git(repo, "cherry-pick", "--abort", check=False)
            conflict = True
            break
    if conflict:
        git(repo, "reset", "--hard", f"refs/remotes/origin/{target}")
        git(repo, "commit", "--allow-empty", "-m",
            f"Request manual backport of !{mr['iid']}\n\n{marker}\nBackport-conflict: yes")
    else:
        message = git(repo, "show", "-s", "--format=%B", "HEAD").stdout.rstrip()
        git(repo, "commit", "--amend", "-m", message + "\n\n" + marker)
    # Explicit refspec, no force, no deletions. Races fail without overwriting.
    git(repo, "push", "origin", f"HEAD:refs/heads/{branch}")
    return conflict


def assignee(api, mr):
    for user in [mr.get("author"), mr.get("merge_user")]:
        if user:
            try:
                member = api.call(f"/members/all/{user['id']}")
                if member.get("state") == "active" and member.get("access_level", 0) >= 30:
                    return user["id"]
            except ApiError as error:
                if error.status != 404:
                    raise
    return None


def backport(api, repo, mr, target):
    branch = f"backport/{mr['iid']}/{target}"
    existing = api.pages("/merge_requests?" + urlencode({"scope": "all", "state": "all",
                         "source_branch": branch, "target_branch": target}))
    if existing:
        print(f"Backport of !{mr['iid']} already has an MR; skipping")
        return
    # Fail visibly if a selected version branch does not exist.
    git(repo, "rev-parse", "--verify", f"refs/remotes/origin/{target}")
    conflict = prepare_branch(api, repo, mr, target, branch)
    title = f"Backport to {target}: {mr['title']}"
    body = (f"This MR backports {mr['web_url']} to `{target}`.\n\n"
            "Review the changes and merge after all checks pass.")
    if conflict:
        title = "Draft: " + title
        body += ("\n\nAutomatic cherry-picking could not complete. This branch contains an empty "
                 "commit; apply the original MR changes manually, resolve conflicts, and push "
                 "without force before marking this MR ready.")
    payload = {"source_branch": branch, "target_branch": target, "title": title[:255],
               "description": body, "remove_source_branch": True}
    user = assignee(api, mr)
    if user:
        payload["assignee_id"] = user
    api.call("/merge_requests", payload)
    print(f"Created {'draft ' if conflict else ''}backport MR for !{mr['iid']}")


def main():
    env = os.environ
    branch = env.get("CI_COMMIT_BRANCH", "")
    default = env["CI_DEFAULT_BRANCH"]
    if env.get("CI_PIPELINE_SOURCE") != "push" or not eligible_branch(branch, default):
        print("Not an eligible post-merge push; skipping")
        return
    token = env.get("BACKPORT_TOKEN")
    if not token:
        raise RuntimeError("Set the masked, protected BACKPORT_TOKEN CI/CD variable")
    api = Api(env["CI_API_V4_URL"], env["CI_PROJECT_ID"], token)
    sha = env["CI_COMMIT_SHA"]
    matches = [mr for mr in api.pages(f"/repository/commits/{sha}/merge_requests")
               if merged_here(mr, sha, branch)]
    if len(matches) > 1:
        raise RuntimeError("More than one merged MR matches this push")
    if not matches:
        print("Push is not a merged MR; skipping")
        return
    mr = api.call(f"/merge_requests/{matches[0]['iid']}")
    branches = targets(mr, default, env["BACKPORT_PROJECT_NAME"])
    if not branches:
        print("Merged MR has no other backport targets; skipping")
        return
    with tempfile.TemporaryDirectory(prefix="gitlab-backport-") as temp:
        directory = Path(temp)
        askpass = directory / "askpass"
        askpass.write_text('#!/bin/sh\ncase "$1" in *Username*) printf "%s" oauth2;; *) printf "%s" "$BACKPORT_TOKEN";; esac\n')
        askpass.chmod(0o700)
        git_env = dict(env, GIT_ASKPASS=str(askpass), GIT_TERMINAL_PROMPT="0")
        # Git commands inherit askpass without ever putting a token in argv or config.
        os.environ.update({key: git_env[key] for key in ["GIT_ASKPASS", "GIT_TERMINAL_PROMPT"]})
        repo = directory / "repo"
        url = f"{env['CI_SERVER_URL']}/{env['CI_PROJECT_PATH']}.git"
        git(directory, "clone", "--no-checkout", "--", url, str(repo))
        git(repo, "config", "user.name", "GitLab backport bot")
        git(repo, "config", "user.email", "backport@noreply.gitlab.com")
        failures = 0
        for target in branches:
            try:
                backport(api, repo, mr, target)
            except (RuntimeError, ValueError) as error:
                # Report identifiers only; git/API output can contain secrets.
                print(f"Backport of !{mr['iid']} to {target} failed: {error}")
                failures += 1
        if failures:
            raise RuntimeError(f"{failures} backport target(s) failed; retry after correcting the cause")


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print(str(error) if isinstance(error, (RuntimeError, ValueError)) else "Backport job failed")
        raise SystemExit(1) from None
