# Set up workflow for checking PR project assignments

The [`.github/workflows/pr-project-assignment-check-reusable.yml`](../.github/workflows/pr-project-assignment-check-reusable.yml) workflow checks if a PR has a project assigned in the GitHub sidebar. The following outcomes are possible when the workflow runs:

- **If projects are assigned:** Returns a comma-separated list of project titles.
  - A comment will be posted on the PR, mentioning the PR creator (@username) as a heads-up.
- **If no projects are assigned:** Returns an empty output.
  - The workflow shows a warning annotation (non-blocking) if no projects are found. The reason why this is a warning and not an error is to allow flexibility in cases where project assignment may not be mandatory.

## Requirements

- The repository must have GitHub Projects enabled.
- The workflow requires `contents: read` and `pull-requests: write` permissions.

> [!NOTE]
>
> Supports all GitHub project types:
>
> - Organization and repository-level GitHub Projects V2 (public projects work with default token)
> - User-level GitHub Projects V2 (requires optional token for private projects)  
> - Classic project boards (legacy, being deprecated)

### Optional: Private project support

To detect **private projects**, you'll need to provide a Personal Access Token with `read:project` scope:

1. **Create a PAT:** Go to [GitHub Settings > Developer settings > Personal access tokens](https://github.com/settings/tokens)
2. **Add `read:project` scope:** This enables access to private projects.
3. **Add as repository secret:** Store the token as `PROJECT_READ_TOKEN` in your repository secrets.
4. **Uncomment the secrets section** in your workflow file (see example in sample workflow).

> [!WARNING]
>
> **Without this PAT:** Only public projects will be detected. Private projects will be ignored, and the workflow will only return public projects assigned to the PR.

## Implement the workflow

Copy the [`pr-project-assignment-check.yaml`](./pr-project-assignment-check.yaml) file to your repository's `.github/workflows/` directory to automatically check project assignments when PRs are opened.
