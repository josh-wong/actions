# 🌍 Auto-translate documentation workflow

Automated translation of English documentation to Japanese using Claude Code GitHub Action. This workflow provides both automatic translation when PRs are merged and manual translation on-demand, with advanced features for handling documentation updates and preserving existing translations.

## 🚀 Quickstart

This section covers the essential setup steps to get the auto-translation workflow running in your repository.

### 🔐 Setup authentication

Add your Claude Code OAuth token to repository secrets:

1. **Install Claude Code:** Ensure that you have Claude Code installed on your computer.
2. **Generate an OAuth token:** In **Terminal** on your computer, run `claude setup-token` and follow the instructions to get a Claude Code OAuth token.
3. **Add the token to the repository secrets:**
   - Go to **Settings** → **Secrets and variables** → **Actions**.
   - Create a new repository secret: `CLAUDE_CODE_OAUTH_TOKEN` = your Claude Code OAuth token

### ✅ Ready to use

After authentication is configured, the workflow is ready to use in two ways:

- **Automatic:** Creates a PR with Japanese translations after merging any PR with changes to Markdown files (`.md` or `.mdx`) in `docs/en-us/`.
- **Manual:** Use workflow dispatch to manually run the workflow if needed.

## ⚙️ Current workflow configuration

The workflow is built by using GitHub Actions and Claude Code Action to provide seamless translation capabilities.

### 📄 Auto-translate documentation workflow file

The complete workflow configuration is available in [`.github/workflows/auto-translate-documentation-reusable.yml`](/.github/workflows/auto-translate-documentation-reusable.yml).

This workflow file contains:

- **Trigger configuration:** Automatic activation on merged PRs and manual workflow dispatch
- **Permissions setup:** Required GitHub permissions for creating PRs and accessing repositories
- **Claude Code Action integration:** Complete configuration with dynamic mode switching
- **Comprehensive translation instructions:** Detailed prompts for high-quality Japanese translations
- **PR template integration:** Automatic creation of formatted translation PRs

#### Key capabilities

- **Smart document handling:** Detects merged PRs and intelligently processes both new and updated documents.
- **Diff-based translation:** Only translates changed sections in existing documents, preserving unchanged content.
- **Complete translations:** Creates full translations for new documents.
- **Component integration:** Automatically adds `TranslationBanner` component and `displayed_sidebar` configuration.
- **Structure preservation:** Maintains exact directory structure and formatting.
- **Enhanced PR creation:** Uses repository PR template with Japanese-specific adaptations and usage tracking.
- **Multiple file support:** Handles single or multiple file changes in one PR.

### 🎛️ Manual translation capabilities

The workflow supports manual triggering via GitHub Actions interface with optional PR number input for specific translation jobs. For detailed steps, see the [Manual translation workflow](#-manual-translation-workflow) section.

## 📋 Usage examples

This section demonstrates the different ways to use the auto-translation workflow in your development process.

### 🔄 Automatic translation workflow

```bash
# 1. Edit documentation.
echo "# New Feature" > docs/en-us/new-feature.mdx

# 2. Create and merge PR.
git add docs/en-us/new-feature.mdx
git commit -m "docs: Add new feature documentation"
git push origin feature-branch

# 3. Merge PR via GitHub UI.
# 4. Workflow automatically runs and creates Japanese translation PR.
```

### ⚡ Manual translation workflow

For on-demand translation, you can trigger the workflow manually through the GitHub Actions interface:

1. Go to the **Actions** tab.
2. Select the **Auto-translate documentation (ja-jp)** workflow.
3. Select **Run workflow**.
4. Optionally specify PR number for specific translation.
5. Select the **Run workflow** button.

### 📝 Document update workflow

```bash
# For existing documents with Japanese translations:
# 1. Edit existing English document.
echo "## New Section" >> docs/en-us/existing-guide.mdx

# 2. Create and merge PR.
# 3. Workflow detects changes and updates only changed sections.
# 4. Preserves existing Japanese content that hasn't changed.
```

## 🔧 Technical details

This section covers the technical specifications and capabilities of the auto-translation workflow.

### 📁 File processing

The workflow processes documentation files with the following specifications:

- **Supported formats:** Markdown (`.md` and `.mdx`)
- **Directory structure:** Mirrors source structure from `docs/en-us/` to `docs/ja-jp/`
- **Encoding:** UTF-8 with proper Japanese character support

### 🎯 Translation quality

The workflow ensures high-quality translations with these features:

- **Professional Japanese:** Natural, technical writing style
- **Format preservation:** All MDX/Markdown structure maintained
- **Code blocks:** Kept in English for technical accuracy
- **Links and references:** Preserved exactly as in source
- **Technical terms:** Appropriately handled for Japanese technical documentation

### 🔐 Authentication

The workflow uses secure authentication through official Claude integration:

- **Official Claude Code Action:** Uses Anthropic's supported GitHub integration.
- **OAuth authentication:** Secure Claude Code OAuth token.
- **Token management:** Stored securely in GitHub repository secrets.

## 🎨 Customization

You can customize the workflow behavior to match your specific requirements.

### 🔧 Modify translation behavior

If necessary, you can edit `direct_prompt` in `auto-translate-documentation-reusable.yml` to change translation behavior:

```yaml
direct_prompt: |
  Translate the following documentation from English to Japanese:
  - Use casual Japanese.
  - Translate code examples to Japanese.
```

This configuration changes the translation style from natural and polite to casual and translates the code examples to Japanese.

### 📂 Add file types

Update the `paths` configuration:

```yaml
paths:
  - "docs/en-us/**/*.md"
  - "docs/en-us/**/*.mdx"
  - "docs/en-us/**/*.txt"     # Add text files.
  - "guides/**/*.md"          # Add the guides directory
```

### 🌐 Change target language

Modify the prompt to translate to other languages:

```yaml
direct_prompt: |
  - Translate English documentation to Spanish.
  - Save translations in the docs/es-es/ directory.
```

## 🔍 Troubleshooting

This section provides solutions to common issues you might encounter when using the auto-translation workflow. Most problems can be resolved by checking authentication, permissions, or workflow configuration.

### ⚠️ Common issues

The following are the most frequently encountered problems and their solutions.

#### "No trigger found, skipping remaining steps"

This indicates the automatic trigger isn't working.

- Try using the manual workflow dispatch instead.
- Check that the PR was **merged** (not closed without merging).
- Verify the file paths match the trigger patterns.

#### "No CLAUDE_CODE_OAUTH_TOKEN found"

This indicates the workflow cannot authenticate with Claude's API due to a missing or incorrectly configured token.

- Verify the secret is added to repository settings
- Check the secret name exactly matches `CLAUDE_CODE_OAUTH_TOKEN`
- Ensure you have repository admin access to add secrets

#### "Translation not creating PR"

This indicates the workflow completed translation but failed to create the pull request with the Japanese content.

- Verify workflow has proper permissions (`contents: write`, `pull-requests: write`)
- Check workflow logs for authentication issues
- Review Claude's output for error details

### 🐛 Debug steps

1. Check the workflow run logs in **Actions** tab.
2. Try the manual workflow dispatch first for testing.
3. Verify the repository permissions and secrets.
4. Review the generated PR content and structure.
5. Check Claude usage tracking information in PR descriptions.

## 📈 Best practices

This section provides recommendations for organizing your documentation and optimizing the translation workflow for better results and maintainability.

### 📁 Documentation structure

```text
docs/
├── en-us/           # English source files
│   ├── api/
│   ├── guides/
│   └── tutorials/
└── ja-jp/           # Japanese translations (auto-generated)
    ├── api/
    ├── guides/
    └── tutorials/
```

### 💡 Workflow tips

1. **Write clear English docs first:** Better source = better translation.
2. **Use consistent terminology:** Helps translation accuracy.
3. **Merge PRs:** Reduces translation lag.
4. **Review translations:** Use manual workflow for IMPORTANT docs.
5. **Keep code examples in English:** Better for technical accuracy.

### ⚡ Performance optimization

- **Batch changes:** Group related doc updates in single PRs.
- **Use selective paths:** Only translate necessary directories.
- **Monitor API usage:** Track Claude Code Action consumption.
- **Regular cleanup:** Remove outdated translated files.

## 🔗 Additional resources

- [Claude Code GitHub Action documentation](https://docs.anthropic.com/en/docs/claude-code/github-actions)
- [Official repository](https://github.com/anthropics/claude-code-action)
- [Anthropic API documentation](https://docs.anthropic.com/en/api)
