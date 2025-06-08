# Auto Documentation Generator

This folder contains scripts used by the auto-docs reusable GitHub Action workflow to generate documentation drafts based on merged pull requests with the "new feature" label.

## How it works

The auto-docs-generate-reusable.yaml workflow:

1. Triggers when a pull request with the "new feature" label is merged.
2. Uses the Claude API to analyze the PR content.
3. Generates a documentation draft as a Markdown/MDX file.
4. Creates a draft PR with the generated documentation.

## Using this workflow in your repository

To use this workflow in your repository, create a new workflow file in your repo with the following content:

```yaml
name: Generate documentation for new features

on:
  pull_request:
    types: [closed]
    branches:
      - main # Or your default branch.
  workflow_dispatch:

jobs:
  generate-docs:
    if: github.event.pull_request.merged == true || github.event_name == 'workflow_dispatch'
    uses: josh-wong/actions/.github/workflows/auto-docs-generate-reusable.yaml@main
    with:
      output_dir: 'docs/auto-generated' # Optional. Defaults to docs/auto-generated.
      file_extension: 'mdx' # Optional. Defaults to .mdx.
    secrets:
      CLAUDE_API_KEY_ACTION_AUTO_DOCS: ${{ secrets.CLAUDE_API_KEY_ACTION_AUTO_DOCS }}
```

## Prerequisites

- You need to set up the `CLAUDE_API_KEY_ACTION_AUTO_DOCS` secret in your repository.
- The repository must have the GitHub CLI installed on the runner.
- Pull requests must be labeled with "new feature" to trigger documentation generation.

## Configuration

The workflow accepts the following inputs:

- `output_dir`: Directory where the generated documentation will be saved (default: `docs/auto-generated`)
- `file_extension`: File extension for the generated documentation file (default: `mdx`)

## Generated documentation format

The documentation is generated with the following sections:

1. Overview - A brief description of the feature
2. Purpose - Why this feature was added and what problem it solves
3. How it works - Technical explanation of the implementation
4. Usage - How to use this feature, with code examples if applicable
5. Configuration - Any configuration options or settings
6. Related features or components - How this feature interacts with other parts of the system
