# Shared GitLab automation

This directory contains reusable GitLab CI/CD jobs for projects that include `josh-wong/actions`. GitHub continues to use the existing workflows in `.github/workflows/`; mirroring makes both sets of automation available from the same repository history.

## Include the backport job

Consumers select an immutable shared revision with a project CI/CD variable. `BACKPORT_ACTIONS_REF` must be an unprotected, non-secret variable containing the full lowercase commit SHA of the reviewed shared implementation. It must resolve in MR pipelines as well as push pipelines. Keep this project public so the runner can download `backport.py` at the same revision.

```yaml
include:
  - project: josh-wong/actions
    ref: $BACKPORT_ACTIONS_REF
    file: /gitlab/auto-mr-backport.yml
    rules:
      - if: '$BACKPORT_ACTIONS_REF =~ /^[a-f0-9]{40}$/'

variables:
  BACKPORT_PROJECT_NAME: Example Project
```

The consumer's workflow must permit push pipelines on its default branch and numeric `major` and `major.minor` branches. The shared job runs in `.post`, after the consumer's normal checks pass. It never runs in an MR pipeline. Use a masked, hidden, protected `BACKPORT_TOKEN` with `api` scope in each consumer, and protect eligible target branches. An active Developer can create backport branches and MRs; use the least role required by the consumer's branch protections. The token stays out of command arguments, Git configuration, and job logs.

GitLab.com project access tokens require Premium or Ultimate. Free-tier consumers need an explicitly approved alternative, such as a dedicated automation account's personal access token. Never reuse a broad personal token without reviewing its access. Record expiry, owner, and renewal reminders in the credential manager. See [GitLab project token requirements](https://docs.gitlab.com/user/project/settings/project_access_tokens/).

## Choose backport targets

Before merging, add labels such as `backport::main`, `backport::1`, and `backport::1.2`. The default branch can have any name. Other targets must be numeric `major` or `major.minor` branches that already exist. An unsupported `backport::` label fails rather than being silently ignored.

The MR milestone can also be named exactly `<BACKPORT_PROJECT_NAME> major.minor.patch`, preserving the old GitHub project-title mapping. A version with minor and patch both zero selects the default branch; a nonzero minor and zero patch selects the major branch; a nonzero patch selects the major.minor branch. Label and milestone targets are combined, deduplicated, and exclude the target of the original merge.

The job verifies the exact merged MR for the pipeline SHA. It handles merge commits, squash merges, and ordinary fast-forward sequences. Generated `backport/` MRs do not propagate, and no labels are copied. A conflict, empty pick, or ambiguous nested merge in a fast-forward sequence creates an empty commit and a draft MR for manual work. Missing target branches and API or Git failures fail the job, while remaining targets are still attempted.

Each target uses `backport/<original MR IID>/<target>`. Existing MRs in any state prevent duplicates. A branch pushed before MR creation failed is recoverable only if its last commit carries the original MR provenance. No operation overwrites or deletes a remote ref. The original author is assigned when they are an active Developer in the consumer; otherwise the merger is tried.

## Mirror this repository

Set up the GitLab counterpart once before enabling consumer includes. The GitHub repository is public; create the GitLab project public and empty, without an initial README, under `josh-wong/actions`.

1. Fetch all GitHub heads and tags into a fresh clone. Seed GitLab with explicit non-force refspecs: `git push --atomic gitlab 'refs/heads/*:refs/heads/*' 'refs/tags/*:refs/tags/*'`, where `gitlab` is an authenticated remote. Ensure all branches are local heads first. Do not use `--mirror`, forced refspecs, `--prune`, or `--force`.
2. Add `.github/workflows/mirror-to-gitlab.yaml` to GitHub after review. Set the GitHub repository secret `GITLAB_TOKEN` to a GitLab token with `write_repository` and permission to push protected branches in the shared project. The workflow fetches all heads into a dedicated namespace and pushes branches and tags atomically without force. It ignores deletion events and never pushes `origin/HEAD` as a branch.
3. Configure the GitLab project's **Settings > Repository > Mirroring repositories** push mirror to `https://github.com/josh-wong/actions.git`. Use a GitHub fine-grained token limited to this repository, with Contents and Workflows write permissions. Select **Keep divergent refs** and mirror all branches. Review these settings before enabling the mirror. Keeping divergent refs prevents overwriting downstream history; it does not suppress branch deletions.
4. Record both tokens' owners, expiration dates, and renewal reminders (for example, 30 and 7 days before expiry). Update the GitHub secret and GitLab mirror credential when rotating. Do not store credential values in documentation or Git remotes.
5. Verify one reviewed test commit from each host reaches the other with the same SHA. Verify a deliberately divergent test branch rejects syncing without losing either side's commits. Resolve the disposable test divergence with a merge and normal push. Check that the mirror workflow settles after a no-op push. Never test divergence on a release branch.
6. Remove disposable test refs on both hosts after review. The GitHub workflow does not propagate deletions. GitLab push mirrors can delete merged branches downstream, so do not promise symmetric deletion behavior. Record the observed behavior and successful runs before marking setup complete.

GitLab's [push mirror documentation](https://docs.gitlab.com/user/project/repository/mirror/push/) explains divergent-ref and deletion behavior. If either mirror rejects divergence, merge the histories and push normally. Do not enable overwriting divergent refs. Mirroring code does not mirror issues, MRs, secrets, or host settings.

## Validate changes

Run `python3 -m unittest discover -s gitlab -p 'test_*.py'` for deterministic backport tests. They use temporary local repositories and fake API responses. Run `python3 -m unittest discover -s gitlab -p 'test_mirror.py'` for the mirror refspec tests. No test needs a live token or changes a hosted repository.

Before activation, use GitLab CI Lint with the real include SHA, merge an approved test MR in a consumer, confirm successful and conflicting backports, and retry to check idempotency. Hosted mirror checks and credentials cannot be validated by local tests. Updating the shared implementation requires each consumer to review and advance its pinned SHA explicitly.
