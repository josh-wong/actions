# Actions Repository

This repository contains GitHub Actions and automation workflows for various development tasks.

## 📁 Available Actions

### 🌐 Auto-Translate Markdown Documentation
**Location**: [`auto-translate-markdown-script/`](./auto-translate-markdown-script/)

Automatically translates English documentation to Japanese using Claude Code GitHub Action.

**Features:**
- **Automatic translation** when documentation PRs are merged
- **Manual translation** via `@claude translate docs` comments
- **Professional Japanese** with preserved formatting
- **Official Claude Code Action** for reliability

**Quick Start:**
1. Add `ANTHROPIC_API_KEY` to repository secrets
2. Copy workflows from `.github/workflows/`
3. Merge documentation PRs or use `@claude` comments

### 📚 Auto-Generate Documentation
**Location**: [`auto-docs-script/`](./auto-docs-script/)

Automatically generates documentation using various tools and AI.

### 🔄 Auto-PR Creation
**Location**: [`auto-pr-script/`](./auto-pr-script/)

Automated pull request creation and management workflows.

## 🚀 Quick Setup

### For Auto-Translation (Recommended)
```bash
# 1. Add to your repository secrets
ANTHROPIC_API_KEY=your_claude_api_key

# 2. Copy workflow files
cp .github/workflows/auto-translate-documentation.yml your-repo/.github/workflows/
cp .github/workflows/claude-translation-assistant.yml your-repo/.github/workflows/

# 3. Ready to use!
# - Automatic: Merge PRs with docs changes
# - Manual: Comment "@claude translate docs"
```

## 📖 Documentation

Each subdirectory contains its own README with detailed setup and usage instructions:

- [`auto-translate-markdown-script/README.md`](./auto-translate-markdown-script/README.md) - Translation setup
- [`auto-docs-script/README.md`](./auto-docs-script/README.md) - Documentation generation
- [`auto-pr-script/README.md`](./auto-pr-script/README.md) - PR automation

## 🛠️ Development

This repository uses:
- **GitHub Actions** for automation workflows
- **Official APIs** for reliable integrations (Claude Code, GitHub, etc.)
- **Reusable workflows** for easy adoption across repositories

## 📄 License

Open source - feel free to use and adapt these workflows for your own projects.
