# GitHub counterpart review reminders

This repository's GitHub workflow opens a review reminder in `gitlab.com/josh-wong/actions` after mapped automation changes merge on GitHub. The GitLab repository maintains its own jobs and notifier. Their implementations and histories are independent; this repository does not contain the GitLab CI configuration or reusable GitLab jobs.

## Review relevant files

`mappings.json` explicitly pairs automation files on the two hosts. Only mapped files generate a reminder; unrelated changes are skipped. The backport and reminder systems are mapped initially. Renamed files match their old and new paths, and deleted files remain eligible. Reminder issues include the source change, merge commit, changed paths, and counterpart patterns to review. They ask for equivalent behavior to be reviewed, not for files to be copied verbatim.

The notifier verifies that the pushed commit completed a merged change into the default branch. Direct pushes, other branches, and unmerged changes are skipped. Only the merge at the push tip is considered; do not batch several merged changes into a manual push and expect one issue for each. Incomplete or capped API file lists fail for manual review rather than silently omitting files.

## Handle reminders and retries

Apply and test any relevant counterpart update, or close the reminder with an explanation of why no change is needed. Put this exact marker in the counterpart PR/MR description before merging a completed port to suppress a reminder back to the source.

```text
<!-- actions-sync-reminder:skip -->
```

The marker applies to the whole merge. Omit it if the counterpart update introduces additional behavior that needs review on the original host. Creating or editing an issue does not trigger either notifier.

Generated issues carry a provenance marker keyed by source host, repository, and merge commit. Open and closed issues are checked before creating another reminder, so retries do not duplicate a closed issue. Do not delete these markers. If an issue-create response is lost after the server accepts it, retry the original job: the notifier checks for the marker before attempting another POST. If a capped file list prevents processing, review that merge manually.

## Configure the GitHub workflow

`.github/workflows/remind-gitlab.yaml` runs on default-branch pushes using `ubuntu-slim`. The notifier reads the GitHub push event and verifies the exact merged PR through GitHub's API. It uses the built-in read token for source metadata and never runs on unmerged PR code. Its per-commit concurrency group prevents simultaneous retries for the same source revision.

1. Add `GITLAB_REMINDER_TOKEN` as a GitHub Actions secret. Use the narrowest GitLab credential supported by the destination for listing and creating project issues. Legacy personal tokens need `api`, which grants broader access; review the permissions and prefer a dedicated automation identity restricted to the destination project. GitLab.com Free does not offer project access tokens.
2. Review and merge the GitHub workflow, notifier, file mappings, and tests. The opposite direction is configured separately in the GitLab repository. No GitLab pipeline file or Git push credential is needed in this repository.
3. Record the token owner, expiry, and renewal reminders in the credential manager. Keep credentials out of Git, logs, and issue bodies.

Unrelated merges can finish without the destination token; a relevant merge that requires a reminder fails visibly if the token is missing. Correct credential or network failures and rerun the original job.

## Validate changes

Run `python3 -m unittest discover -s sync-reminders -p 'test_*.py'`. The GitHub reminder test workflow runs these fixture-only checks on relevant PRs and default-branch pushes using `ubuntu-slim`, without destination credentials or hosted issue creation.

Inside a GitHub job's push-event environment, run `python3 sync-reminders/notify.py github --dry-run` to print a proposed issue without creating it. The dry run reads source metadata but needs no destination token. Before activation is complete, merge an approved mapped change, confirm the expected GitLab issue appears, and retry to check duplicate prevention. Verify the reverse direction separately in GitLab and use the skip marker for a completed counterpart update.

GitHub documents [commit-associated PRs](https://docs.github.com/en/rest/commits/commits#list-pull-requests-associated-with-a-commit) and [PR file lists](https://docs.github.com/en/rest/pulls/pulls#list-pull-requests-files). GitLab documents [project issues](https://docs.gitlab.com/api/issues/#list-project-issues).
