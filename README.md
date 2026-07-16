# 🎯 Actions repository

This repository contains GitHub Actions and automation workflows for various development tasks.

## 📁 Available actions

Choose from the following automation workflows to enhance your development process.

### 📚 Auto-generate documentation

Automatically generates documentation using various tools and AI.

| Field           | Details                                              |
|-----------------|------------------------------------------------------|
| **Location**    | [`auto-docs-script/`](./auto-docs-script/)           |
| **Setup guide** | [View documentation](./auto-docs-script/README.md)   |

### 🔄 Auto-PR creation

Automated pull request creation and management workflows.

| Field           | Details                                          |
|-----------------|--------------------------------------------------|
| **Location**    | [`auto-pr-script/`](./auto-pr-script/)           |
| **Setup guide** | [View documentation](./auto-pr-script/README.md) |

### 🌍 Auto-translate documentation

Automatically translates English documentation to Japanese using Claude Code GitHub Action. Features automatic translation on PR merge and manual workflow dispatch.

| Field           | Details                                                                |
|-----------------|------------------------------------------------------------------------|
| **Location**    | [`auto-translate-markdown-script/`](./auto-translate-markdown-script/) |
| **Setup guide** | [View documentation](./auto-translate-markdown-script/README.md)       |

### 🔢 Bump doc versions

Anchored, scope-limited patch-version bumper for the ScalarDB and ScalarDL docs. Rewrites Maven/Gradle coordinates, Docker image tags, Javadoc URLs, GitHub release-tag URLs, JAR filenames, and shell env vars across the internal source-of-truth repo and its public docs-site mirror. Opens a PR for a human to review — never auto-merges.

| Field           | Details                                                                |
|-----------------|------------------------------------------------------------------------|
| **Location**    | [`bump-doc-versions/`](./bump-doc-versions/)                           |
| **Setup guide** | [View documentation](./bump-doc-versions/README.md)                    |

## 🚀 Getting started

Follow these simple steps to integrate any of these actions into your repository.

1. **Choose an action** from the list above.
2. **Follow the setup guide** in each subdirectory's README.
3. **Copy the workflows** to your repository's `.github/workflows/` directory.

Each action has its own comprehensive documentation with setup instructions, usage examples, and troubleshooting guides.

## 📖 Documentation

Each action includes detailed documentation to help you configure and use the workflows effectively.

For detailed setup and usage instructions, see the individual README files:

- **[`auto-translate-markdown-script/README.md`](./auto-translate-markdown-script/README.md):** Translation workflow setup
- **[`auto-docs-script/README.md`](./auto-docs-script/README.md):** Documentation generation
- **[`auto-pr-script/README.md`](./auto-pr-script/README.md):** PR automation
- **[`bump-doc-versions/README.md`](./bump-doc-versions/README.md):** ScalarDB/ScalarDL patch-version bump automation

## 🛠️ Development

These workflows are built by using modern GitHub Actions best practices and official integrations.

This repository uses:

- **GitHub Actions** for automation workflows
- **Official APIs** for reliable integrations (Claude Code, GitHub, etc.)
- **Reusable workflows** for easy adoption across repositories
