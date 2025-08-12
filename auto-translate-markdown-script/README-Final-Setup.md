# Auto-Translation Workflows - Final Setup

## 🎯 Overview

This repository now uses the **official Claude Code GitHub Action** for automated documentation translation. The old custom CLI implementation has been removed and replaced with more reliable, officially supported workflows.

## 📁 Available Workflows

### 1. **Automatic Translation on PR Changes**
**File**: `auto-translate-docs-automation.yml`
- **Trigger**: Automatically when docs in `docs/en-us/` are modified in PRs
- **Mode**: Agent mode with automatic processing
- **Best for**: Hands-off automation

### 2. **Direct PR Integration** 
**File**: `auto-translate-markdown-claude-official.yml`
- **Trigger**: PR opened/synchronized with doc changes
- **Mode**: Direct prompt with immediate translation
- **Best for**: Immediate automated translation

### 3. **Interactive Translation Assistant**
**File**: `claude-translation-assistant.yml`
- **Trigger**: Comment `@claude translate docs` on any PR/issue
- **Mode**: Interactive with custom instructions
- **Best for**: Manual control and specific translation requests

### 4. **Setup Testing**
**File**: `test-claude-setup.yml`
- **Trigger**: Manual workflow dispatch
- **Purpose**: Test Claude Code Action authentication and setup
- **Best for**: Verifying your setup works

## 🚀 Quick Start

### 1. Setup Authentication
Choose one method:

**Option A: Automatic Setup (Recommended)**
```bash
claude
/install-github-app
```

**Option B: Manual Setup**
1. Install Claude App: https://github.com/apps/claude
2. Add `ANTHROPIC_API_KEY` to repository secrets

### 2. Test Your Setup
1. Go to Actions tab in your repository
2. Run "Test Claude Translation" workflow manually
3. Verify it completes successfully

### 3. Start Using
- **Automatic**: Modify any file in `docs/en-us/` and create a PR
- **Manual**: Comment `@claude translate docs` on any PR/issue

## 🔧 Technical Details

### Authentication
- Uses official Claude GitHub App with OIDC authentication
- Secure token exchange, no custom token management
- Requires `ANTHROPIC_API_KEY` in repository secrets

### File Processing
- **Source**: `docs/en-us/**/*.md` and `docs/en-us/**/*.mdx`
- **Target**: `docs/ja-jp/` (mirrors source structure)
- **Preservation**: All formatting, code blocks, and links maintained
- **Encoding**: Proper UTF-8 for Japanese characters

### Permissions Required
```yaml
permissions:
  contents: write        # To modify files
  pull-requests: write   # To create/update PRs
  issues: write         # To comment on issues
  id-token: write       # For OIDC authentication
```

## 🎮 Usage Examples

### Automatic Translation
1. Edit `docs/en-us/api-guide.md`
2. Create PR with your changes
3. Workflow automatically creates `docs/ja-jp/api-guide.md`
4. Japanese translation appears in same PR

### Manual Translation
1. Comment on any PR: `@claude translate docs`
2. For specific files: `@claude translate the new API documentation to Japanese`
3. Claude analyzes and creates translations
4. Results committed to the PR branch

### Custom Instructions
```
@claude translate docs but keep all code examples in English and add a note at the top of each Japanese file indicating it's a translation
```

## 🔍 Troubleshooting

### ❌ "Authentication failed"
- Verify `ANTHROPIC_API_KEY` is set in repository secrets
- Ensure Claude GitHub App is installed on your repository
- Check workflow permissions include `id-token: write`

### ❌ "No files to translate"
- Verify files are in `docs/en-us/` directory
- Check file extensions are `.md` or `.mdx`
- Ensure PR actually modifies documentation files

### ❌ "Workflow not triggering"
- Check file paths match the workflow triggers
- Verify you're creating a PR (not just pushing to main)
- Review workflow conditions and event types

## 📊 Migration Notes

### ✅ What Changed
- **Removed**: Custom Claude CLI scripts and workflows
- **Added**: Official Claude Code GitHub Action workflows
- **Improved**: Authentication, reliability, and error handling
- **Enhanced**: Better GitHub integration and logging

### ✅ Benefits
- Official support from Anthropic
- Better authentication security
- More reliable execution
- Regular updates and improvements
- Native GitHub Actions integration

## 🛠️ Customization

### Modify Translation Behavior
Edit the `direct_prompt` or `custom_instructions` in workflow files to:
- Change translation style or tone
- Add specific formatting requirements
- Include custom terminology handling
- Adjust file processing logic

### Add New File Types
Update the `paths` section in workflows:
```yaml
paths:
  - "docs/en-us/**/*.md"
  - "docs/en-us/**/*.mdx"
  - "docs/en-us/**/*.txt"  # Add new file types
```

### Change Directory Structure
Modify the prompt instructions to use different source/target directories.

## 📚 Additional Resources

- [Claude Code GitHub Action Documentation](https://docs.anthropic.com/en/docs/claude-code/github-actions)
- [Official Repository](https://github.com/anthropics/claude-code-action)
- [Setup Guide](https://github.com/anthropics/claude-code-action/blob/main/docs/setup.md)
- [FAQ](https://github.com/anthropics/claude-code-action/blob/main/docs/faq.md)

---

**Ready to translate?** 🚀 Create a PR with documentation changes or comment `@claude translate docs` to get started!
