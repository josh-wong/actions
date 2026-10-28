# Counterpart review reminders

The GitHub and GitLab `josh-wong/actions` repositories have independent implementations and histories. After relevant automation changes merge into either repository's default branch, a job opens a reminder issue in the other repository. The issue asks for a human review of equivalent behavior; it does not copy files, cherry-pick commits, or push repository history.

## Choose which changes need review

The explicit pairs in `mappings.json` describe equivalent automation. Each entry has a name and GitHub and GitLab file patterns. Currently, backport automation and the reminder system itself are mapped. Other workflows without a mapped equivalent do not generate reminders. Add a pair when a new equivalent implementation exists, and review mapping changes on both hosts.

For example, changing GitHub's `auto-pr-script/create_pull_requests` requests review of GitLab's `gitlab/backport.py` and related pipeline and test files. The implementations are allowed to differ. Reminder issues include the source PR/MR, commit link, relevant changed paths, and counterpart file patterns. Paths are URL-encoded to prevent mentions and GitLab quick actions in filenames from being interpreted.

Both sides run on default-branch pushes and verify through their host API that the exact pushed commit completed a merged PR/MR into that branch. Direct pushes, unmerged changes, and pushes on other branches are skipped. Only the merge at the push tip is processed; do not batch several merged PRs/MRs into a single manual push and expect a reminder for each one. Changed-file lists include both sides of renames and deleted paths. An incomplete or capped API response fails the job for manual review rather than silently ignoring files.

## Configure credentials

Each source runner needs permission to create and list issues in the destination repository. Source metadata is public; GitHub uses its built-in read token and GitLab needs no source API secret. The jobs do not need a token for pushing Git history. Some legacy token scopes permit more than issue access, so review the actual permissions before storing a credential.

1. In the GitHub repository, add `GITLAB_REMINDER_TOKEN` as an Actions secret. Use the narrowest GitLab credential supported by the destination for listing all project issues and creating issues. If using a legacy personal access token, it needs `api`; prefer a dedicated automation account restricted to the target project rather than a broad personal credential. GitLab.com Free does not offer project access tokens. Review available fine-grained permissions in your account before choosing a legacy token.
2. In the GitLab repository, add `GH_REMINDER_TOKEN` as a masked, hidden, protected CI/CD variable. Use a GitHub fine-grained token restricted to `josh-wong/actions` with **Issues: Read and write**. Protect the GitLab default branch so its push pipeline receives the variable. No Contents or Workflows write permission is needed for this reminder token.
3. Review and merge `.github/workflows/remind-gitlab.yaml` on GitHub and the `remind-github` job in `.gitlab-ci.yml` on GitLab. Keep `notify.py`, `mappings.json`, and their tests available on both hosts; change each copy through its own review process.
4. Record token owners and expiration dates in the credential manager, and set renewal reminders before expiry. Keep tokens out of Git, job logs, and issue bodies. Do not configure push mirrors or the obsolete mirror secret `GITLAB_TOKEN` for this design.

Missing destination credentials fail the job only when a relevant merged change requires a reminder. Unrelated changes can finish without them. The GitLab reminder runs even if an earlier check fails, because the change has already merged and still needs counterpart review.

## Handle reminders and retries

Review the source change, then apply and test any relevant counterpart update, or close the issue with an explanation of why no update is needed. Add this exact marker to the counterpart PR/MR description before merging it to suppress a reminder back to the original host.

```text
<!-- actions-sync-reminder:skip -->
```

The skip marker applies to the whole merge. If a counterpart update also introduces a new behavior that needs review on the original host, omit the marker and let that review reminder open. Creating or editing an issue never triggers these jobs, so issue creation itself cannot cause a loop.

Each generated issue includes a marker keyed by source host, repository, and merge commit. The job checks open and closed destination issues before creating one. Closing a reminder does not cause retries to reopen or duplicate it. Per-commit concurrency on GitHub and a resource group on GitLab prevent simultaneous retries for the same source revision. If the create request succeeds but its response is lost, retry the job; it checks for the marker before attempting another create request. Do not delete provenance markers from generated issues.

If a job fails because an API response is incomplete, review the merge manually and open the necessary reminder yourself. If it fails for credentials, permissions, or network access, correct the cause and rerun the original job. There is no automatic retry of issue creation after a failed POST.

## Validate changes

Run `python3 -m unittest discover -s sync-reminders -p 'test_*.py'` for fixture-only checks. Tests cover source merge verification, renamed paths, mappings, skip markers, duplicate prevention, pagination limits, uncertain POST recovery, dry runs, missing tokens, and sanitized errors. Tests create no hosted issues and make no network calls.

Use `python3 sync-reminders/notify.py github --dry-run` or `python3 sync-reminders/notify.py gitlab --dry-run` inside the corresponding CI job environment to print a proposed issue without creating it. A dry run still reads source API metadata but needs no destination token. GitHub needs its push event file; GitLab needs its normal pipeline variables.

Before marking setup complete, merge one approved mapped change on each host and confirm the expected issue appears in the other repository. Retry both jobs and confirm no duplicate appears, then verify a counterpart update with the skip marker does not generate another reminder. These live checks require configured credentials and are separate from the local test suite.

GitHub documents [commit-associated PRs](https://docs.github.com/en/rest/commits/commits#list-pull-requests-associated-with-a-commit), [PR file lists](https://docs.github.com/en/rest/pulls/pulls#list-pull-requests-files), and [issue creation permissions](https://docs.github.com/en/rest/issues/issues#create-an-issue). GitLab documents [MR diffs](https://docs.gitlab.com/api/merge_requests/#list-merge-request-diffs), [project issues](https://docs.gitlab.com/api/issues/#list-project-issues), and [token scopes](https://docs.gitlab.com/user/profile/personal_access_tokens/).
