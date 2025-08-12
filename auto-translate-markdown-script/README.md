# Auto-Translate Markdown Documentation

## 🎯 Overview

Automated translation of English documentation to Japanese using Claude Code GitHub Action. This setup provides both automatic translation when PRs are merged and manual translation on-demand.

## 🚀 Quick Start

### 1. Setup Authentication
Add your Anthropic API key to repository secrets:
- Go to **Settings** → **Secrets and variables** → **Actions**
- Add secret: `ANTHROPIC_API_KEY` = your Claude API key

### 2. Ready to Use!
- **Automatic**: Merge any PR with changes to `docs/en-us/` files
- **Manual**: Comment `@claude translate docs` on any PR or issue

## 📁 Workflow Configuration

### Automatic Translation (`auto-translate-documentation.yml`)
```yaml
# Triggers when documentation PRs are MERGED
on:
  pull_request:
    types: [closed]  # Only runs when PR is merged
    paths:
      - "docs/en-us/**/*.mdx"
      - "docs/en-us/**/*.md"
```

**What it does:**
- Detects merged PRs with documentation changes
- Automatically translates modified files from `docs/en-us/` to `docs/ja-jp/`
- Maintains exact directory structure and formatting
- Commits translations with descriptive messages

### Manual Translation (`claude-translation-assistant.yml`)
```yaml
# Triggers on comments containing @claude
on:
  issue_comment:
    types: [created]
  pull_request_review_comment:
    types: [created]
```

**What it does:**
- Responds to `@claude translate docs` comments
- Allows custom translation instructions
- Processes specific files or entire documentation sets
- Interactive translation with human oversight

## 📚 Usage Examples

### Automatic Translation Workflow
```bash
# 1. Edit documentation
echo "# New Feature" > docs/en-us/new-feature.md

# 2. Create and merge PR
git add docs/en-us/new-feature.md
git commit -m "docs: Add new feature documentation"
git push origin feature-branch

# 3. Merge PR via GitHub UI
# 4. Translation automatically runs and creates docs/ja-jp/new-feature.md
```

### Manual Translation Workflow
```bash
# Comment on any PR or issue:
@claude translate docs

# With specific instructions:
@claude translate the API documentation files to Japanese, keeping all code examples in English

# For specific files:
@claude translate docs/en-us/api-guide.md to Japanese
```

## 🔧 Technical Details

### File Processing
- **Source Directory**: `docs/en-us/**/*.{md,mdx}`
- **Target Directory**: `docs/ja-jp/` (mirrors source structure)
- **Supported Formats**: Markdown (`.md`) and MDX (`.mdx`)
- **Encoding**: UTF-8 with proper Japanese character support

### Translation Quality
- **Professional Japanese**: Natural, technical writing style
- **Format Preservation**: All MDX/Markdown structure maintained
- **Code Blocks**: Kept in English for technical accuracy
- **Links & References**: Preserved exactly as in source
- **Technical Terms**: Appropriately handled for Japanese technical documentation

### Authentication
- **Official Claude Code Action**: Uses Anthropic's supported GitHub integration
- **OIDC Authentication**: Secure token exchange with GitHub
- **API Key Management**: Stored securely in GitHub repository secrets

## 🛠️ Customization

### Modify Translation Behavior
Edit the `direct_prompt` in `auto-translate-documentation.yml`:

```yaml
direct_prompt: |
  Translate documentation with these specific requirements:
  - Use formal Japanese (desu/masu form)
  - Keep API endpoints and code in English
  - Add translation notes for complex technical terms
  - Maintain all original formatting and structure
```

### Add File Types
Update the `paths` configuration:

```yaml
paths:
  - "docs/en-us/**/*.md"
  - "docs/en-us/**/*.mdx"
  - "docs/en-us/**/*.txt"     # Add text files
  - "guides/**/*.md"          # Add guides directory
```

### Change Target Language
Modify the prompt to translate to other languages:

```yaml
direct_prompt: |
  Translate English documentation to Spanish...
  Save translations in docs/es-es/ directory...
```

## 🔍 Troubleshooting

### Common Issues

**❌ "No ANTHROPIC_API_KEY found"**
- Verify the secret is added to repository settings
- Check the secret name exactly matches `ANTHROPIC_API_KEY`
- Ensure you have repository admin access to add secrets

**❌ "Workflow not triggering"**
- Automatic: Ensure PR was **merged** (not just closed)
- Manual: Use exact phrase `@claude` in comments
- Check file paths match the trigger patterns

**❌ "Translation not committing"**
- Verify workflow has `contents: write` permission
- Check for branch protection rules that might block commits
- Review workflow logs for authentication issues

**❌ "Poor translation quality"**
- Customize the prompt with specific style requirements
- Add context about your domain/terminology
- Use manual workflow for complex documents requiring review

### Debug Steps
1. Check workflow run logs in **Actions** tab
2. Verify repository permissions and secrets
3. Test with manual workflow first: `@claude translate docs`
4. Review Claude's commit messages for error details

## 📊 Migration Guide

### From Previous Setups
If upgrading from older auto-translation workflows:

1. **Remove old workflows** (if any):
   - `auto-translate-markdown-claude.yml`
   - `auto-translate-markdown-claude-reusable.yml` 
   - Any OpenAI-based translation workflows

2. **Update secrets**:
   - Remove: `OPENAI_API_KEY_ACTION_TRANSLATE_DOCS`
   - Add: `ANTHROPIC_API_KEY`

3. **Test the new setup**:
   - Try manual translation: `@claude translate docs`
   - Create a test documentation PR and merge it

### Benefits of Current Setup
- **Official Support**: Uses Anthropic's maintained GitHub Action
- **Better Authentication**: Secure OIDC token exchange
- **Focused Workflows**: Clear separation of automatic vs manual
- **Resource Efficient**: Only runs when needed (after merge)
- **More Reliable**: Better error handling and logging

## 📈 Best Practices

### Documentation Structure
```
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

### Workflow Tips
1. **Write clear English docs first** - Better source = better translation
2. **Use consistent terminology** - Helps translation accuracy
3. **Merge PRs promptly** - Reduces translation lag
4. **Review translations** - Use manual workflow for important docs
5. **Keep code examples in English** - Better for technical accuracy

### Performance Optimization
- **Batch changes** - Group related doc updates in single PRs
- **Use manual workflow** - For immediate translation needs
- **Monitor API usage** - Track Claude API consumption
- **Branch protection** - Prevent accidental overwrites of translations

## 🔗 Additional Resources

- [Claude Code GitHub Action Documentation](https://docs.anthropic.com/en/docs/claude-code/github-actions)
- [Official Repository](https://github.com/anthropics/claude-code-action)
- [Anthropic API Documentation](https://docs.anthropic.com/en/api)

---

**Ready to translate!** 🚀 

- **Automatic**: Merge a documentation PR
- **Manual**: Comment `@claude translate docs` on any issue or PR
