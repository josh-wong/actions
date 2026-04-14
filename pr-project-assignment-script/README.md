# Set up workflow for checking PR project assignments

The [`.github/workflows/pr-project-assignment-check-reusable.yml`](../.github/workflows/pr-project-assignment-check-reusable.yml) workflow checks if a PR has a project assigned in the GitHub sidebar. The following outcomes are possible when the workflow runs:

- **If projects are assigned:** Returns a comma-separated list of project titles.
- **If no projects are assigned:** Returns an empty output.
  - The workflow shows a warning annotation (non-blocking) if no projects are found. The reason why this is a warning and not an error is to allow flexibility in cases where project assignment may not be mandatory.

## Requirements

- The repository must have GitHub Projects enabled.
- The workflow requires `contents: read` permission.

## Implement the workflow

Copy the [`pr-project-assignment-check.yaml`](./pr-project-assignment-check.yaml) file to your repository's `.github/workflows/` directory to automatically check project assignments when PRs are opened.

> [!NOTE]
>
> The [`check_pr_project_assignment`](./check_pr_project_assignment) script queries GitHub's GraphQL API to check for project assignments. You don't need to include it in your repository, unless you want to customize the script for your specific needs.
