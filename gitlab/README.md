# Shared GitLab automation

This directory contains reusable GitLab CI/CD jobs for projects that include `josh-wong/actions`. GitHub continues to use its own workflows in `.github/workflows/`. The repositories have independent implementations and histories; [counterpart review reminders](../sync-reminders/README.md) flag relevant merged changes on the other host.

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

## Review counterpart changes

The public GitLab project is `josh-wong/actions`. Its initial history was seeded from GitHub, but ongoing mirroring is not used. Each host keeps the files appropriate to its automation platform.

When mapped automation changes merge into the default branch, a job opens an issue in the other repository with the source change and counterpart files to review. Review and port the relevant behavior manually, or explain why no update is needed. See the [reminder setup guide](../sync-reminders/README.md) for file mappings, credentials, duplicate prevention, and the skip marker for completed counterpart updates.

## Validate changes

Run `python3 -m unittest discover -s gitlab -p 'test_*.py'` for deterministic backport tests. They use temporary local repositories and fake API responses. Run `python3 -m unittest discover -s sync-reminders -p 'test_*.py'` for reminder tests. No test needs a live token or changes a hosted repository.

Before activation, use GitLab CI Lint with the real include SHA, merge an approved test MR in a consumer, confirm successful and conflicting backports, and retry to check idempotency. Verify counterpart reminders in both directions after configuring credentials. Hosted credentials and live issue creation cannot be validated by local tests. Updating the shared implementation requires each consumer to review and advance its pinned SHA explicitly.
