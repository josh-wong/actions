"""Request human review of equivalent automation on the other host."""

import argparse
import fnmatch
import json
import os
import re
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import quote, urlencode
from urllib.request import HTTPRedirectHandler, Request, build_opener


SKIP_MARKER = "<!-- actions-sync-reminder:skip -->"
HOST_NAMES = {"github": "GitHub", "gitlab": "GitLab"}


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, request, response, code, message, headers, new_url):
        # API credentials must never be forwarded to a redirected destination.
        return None


class Api:
    def __init__(self, host, project, token=None):
        self.host = host
        if host == "github":
            self.base = f"https://api.github.com/repos/{project}"
            self.headers = {"Accept": "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28"}
            if token:
                self.headers["Authorization"] = f"Bearer {token}"
        else:
            self.base = f"https://gitlab.com/api/v4/projects/{quote(project, safe='')}"
            self.headers = {"PRIVATE-TOKEN": token} if token else {}

    def call(self, path, data=None):
        request = Request(self.base + path, headers=dict(self.headers, **{"Content-Type": "application/json"}),
                          data=None if data is None else json.dumps(data).encode())
        try:
            with build_opener(NoRedirect).open(request, timeout=60) as response:
                return json.load(response)
        except HTTPError as error:
            raise RuntimeError(f"{self.host} API failed (HTTP {error.code}); no response body logged") from None
        except (URLError, TimeoutError):
            raise RuntimeError(f"{self.host} API connection failed") from None

    def pages(self, path, limit=10000):
        result = []
        for page in range(1, limit // 100 + 1):
            batch = self.call(path + ("&" if "?" in path else "?") + urlencode({"per_page": 100, "page": page}))
            if not isinstance(batch, list):
                raise RuntimeError("Unexpected API list response")
            result.extend(batch)
            if len(batch) < 100:
                return result
        # Fail closed when an API limit might hide relevant files or issues.
        raise RuntimeError("API pagination limit reached; review this change manually")


def validate_config(config):
    for key in ["github_repository", "gitlab_project"]:
        if not re.fullmatch(r"[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+", config[key]):
            raise ValueError("Expected an owner/repository path in reminder configuration")
    if not isinstance(config["mappings"], list) or not config["mappings"]:
        raise ValueError("At least one reminder mapping is required")
    for mapping in config["mappings"]:
        if not re.fullmatch(r"[A-Za-z0-9 _-]+", mapping["name"]):
            raise ValueError("Invalid mapping name")
        for host in ["github", "gitlab"]:
            patterns = mapping[host]
            if not isinstance(patterns, list) or not patterns or not all(isinstance(p, str) and p for p in patterns):
                raise ValueError("Each mapping needs file patterns for both hosts")


def select_mappings(config, host, changed):
    return [mapping for mapping in config["mappings"]
            if any(fnmatch.fnmatchcase(path, pattern) for path in changed for pattern in mapping[host])]


def github_change(api, event, config):
    default = event.get("repository", {}).get("default_branch")
    if (event.get("repository", {}).get("full_name") != config["github_repository"]
            or not default or event.get("ref") != f"refs/heads/{default}"
            or event.get("deleted") is True):
        return None
    sha = event["after"]
    if not re.fullmatch(r"[a-f0-9]{40}", sha):
        raise ValueError("Invalid pushed commit SHA")
    matches = [pr for pr in api.pages(f"/commits/{sha}/pulls") if pr.get("merged_at")
               and pr.get("merge_commit_sha") == sha and pr.get("base", {}).get("ref") == default]
    if len(matches) > 1:
        raise RuntimeError("Multiple merged PRs match the push; review manually")
    if not matches:
        return None
    pr = api.call(f"/pulls/{int(matches[0]['number'])}")
    if not pr.get("merged") or pr.get("merge_commit_sha") != sha:
        raise RuntimeError("PR metadata does not confirm the completed merge")
    if SKIP_MARKER in (pr.get("body") or ""):
        return None
    number = int(pr["number"])
    files = api.pages(f"/pulls/{number}/files", limit=3000)
    changed = {name for file in files for name in [file["filename"], file.get("previous_filename")] if name}
    return {"number": number, "sha": sha, "changed": changed}




def issue_content(config, host, change, mappings):
    sha = change["sha"]
    if not re.fullmatch(r"[a-f0-9]{40}", sha):
        raise ValueError("Invalid merged commit SHA")
    project = config["github_repository" if host == "github" else "gitlab_project"]
    other = "gitlab" if host == "github" else "github"
    number = int(change["number"])
    base = f"https://{host}.com/{project}"
    source_url = f"{base}/pull/{number}" if host == "github" else f"{base}/-/merge_requests/{number}"
    commit_url = f"{base}/commit/{sha}" if host == "github" else f"{base}/-/commit/{sha}"
    marker = f"<!-- actions-sync-reminder:{host}:{project}:{sha} -->"
    # Encode filenames so a merged path cannot inject mentions or quick actions.
    changed = sorted({path for path in change["changed"] if any(
        fnmatch.fnmatchcase(path, pattern) for mapping in mappings for pattern in mapping[host])})
    files = "\n".join(f"- `{quote(path, safe='/._-')}`" for path in changed)
    equivalents = "\n".join(f"- **{mapping['name']}:** " + ", ".join(
        f"`{quote(path, safe='/._-*')}`" for path in mapping[other]) for mapping in mappings)
    name = HOST_NAMES[host]
    title = f"Review equivalent automation after {name} #{number} ({sha[:7]})"
    body = f"""## Description

Review the equivalent automation in this repository after [the source change]({source_url}) merged on {name}. Implementations may differ; decide whether an update is needed rather than copying files verbatim.

## Requirements

- Review the mapped files below and apply the relevant behavior for this host.
- Test any update, or explain why no counterpart change is needed before closing this issue.
- For a counterpart update, put `{SKIP_MARKER}` in its PR/MR description to suppress a reminder back to the source.

## Expected outcome

Equivalent automation stays consistent where appropriate, while host-specific files and history remain independent.

## Steps to reproduce

N/A – automated maintenance reminder.

## Expected behavior

N/A – review the source change and decide whether the counterpart needs an update.

## Actual behavior

N/A – no automatic file copying or repository pushes are performed.

## Environment

Source: {name} `{project}`, merged change #{number}.

## Relevant logs

N/A.

## Technical details

Source commit: [revision {sha[:7]}]({commit_url}).

Changed mapped source files (paths are URL-encoded):

{files}

Counterpart files or patterns to review:

{equivalents}

## Model and review effort

Model: Sonnet | Review effort: medium

{marker}
"""
    return title, body, marker


def send_reminder(destination, title, body, marker):
    path = "/issues?state=all" if destination.host == "github" else "/issues?state=all&scope=all"
    for issue in destination.pages(path):
        if destination.host == "github" and "pull_request" in issue:
            continue
        if marker in (issue.get("body" if destination.host == "github" else "description") or ""):
            print("Reminder already exists (open or closed); skipping")
            return False
    field = "body" if destination.host == "github" else "description"
    # Never retry a failed POST automatically: a retry first checks for its marker.
    destination.call("/issues", {"title": title, field: body})
    print(f"Created review reminder on {destination.host}")
    return True


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("host", choices=["github"])
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()
    config = json.loads(Path(__file__).with_name("mappings.json").read_text())
    validate_config(config)
    source = Api("github", config["github_repository"], os.environ.get("GITHUB_TOKEN"))
    change = github_change(source, json.loads(Path(os.environ["GITHUB_EVENT_PATH"]).read_text()), config)
    destination = Api("gitlab", config["gitlab_project"], os.environ.get("GITLAB_REMINDER_TOKEN"))
    token_name = "GITLAB_REMINDER_TOKEN"
    mappings = select_mappings(config, args.host, change["changed"]) if change else []
    if not mappings:
        print("No relevant merged change; skipping")
        return
    title, body, marker = issue_content(config, args.host, change, mappings)
    if args.dry_run:
        print(title + "\n\n" + body)
        return
    if not os.environ.get(token_name):
        raise RuntimeError(f"Configure {token_name} to create counterpart reminder issues")
    send_reminder(destination, title, body, marker)


if __name__ == "__main__":
    try:
        main()
    except (RuntimeError, ValueError) as error:
        print(str(error))
        raise SystemExit(1) from None
    except Exception:
        print("Reminder job failed; inspect configuration without printing credentials")
        raise SystemExit(1) from None
