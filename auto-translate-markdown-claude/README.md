# Auto-translate Markdown to Japanese

**⚠️ DEPRECATED: This directory contains the old custom CLI implementation.**

**For the current implementation, see:** [`auto-translate-markdown-script/README.md`](../auto-translate-markdown-script/README.md)

## Current Implementation

The auto-translation functionality has been moved to use the **official Claude Code GitHub Action** with a streamlined setup:

### New Workflows Location
- **Main Implementation**: `auto-translate-markdown-script/`
- **Workflow Files**: `.github/workflows/auto-translate-documentation.yml` and `.github/workflows/claude-translation-assistant.yml`

### Key Improvements
- **Official Support**: Uses Anthropic's maintained GitHub Action
- **Better Authentication**: OIDC token exchange instead of custom CLI
- **Simplified Setup**: Just add `ANTHROPIC_API_KEY` to repository secrets
- **More Reliable**: Better error handling and logging
- **Focused Workflows**: Clear separation of automatic vs manual translation

### Migration
If you're using the old implementation from this directory:

1. **Remove old workflows** that reference this directory
2. **Add new workflows** from the current implementation
3. **Update secrets**: Use `ANTHROPIC_API_KEY` instead of custom CLI tokens
4. **Follow new setup**: See [`auto-translate-markdown-script/README.md`](../auto-translate-markdown-script/README.md)

## Quick Start (New Implementation)

### Automatic Translation
```yaml
# Triggers when documentation PRs are merged
on:
  pull_request:
    types: [closed]
    paths:
      - "docs/en-us/**/*.mdx"
      - "docs/en-us/**/*.md"
```

### Manual Translation
```bash
# Comment on any PR or issue:
@claude translate docs
```

**For complete setup instructions, see:** [`auto-translate-markdown-script/README.md`](../auto-translate-markdown-script/README.md)

### 2. Copy workflow files

Copy the entire `auto-translate-markdown` directory to your repository:

```markdown
actions/
├── .github/workflows/
│   └── auto-translate-markdown.yml
└── auto-translate-markdown/
    ├── translate-markdown.js
    ├── claude-code-translator.js
    ├── file-processor.js
    ├── pr-metadata-extractor.js
    ├── anchor-link-fixer.js
    └── package.json
```

### 3. Install dependencies

The workflow automatically installs dependencies, but for local testing:

```bash
cd auto-translate-markdown
npm install
```

### 4. Add translation banner component

Add the translation banner component:

```markdown
import TranslationBanner from '/src/components/_translation-ja-jp.mdx';

<TranslationBanner />
```

## How it works

### Trigger conditions

The workflow triggers when:

- A pull request is **merged** (not just closed).
- The PR contains **modified or added** `.md` or `.mdx` files.
- Files are **not** in existing `docs/ja-jp` directories.

### Translation process

1. **File detection:** Scans merged PR for eligible Markdown files.
2. **Content processing:** Extracts front matter and body content.
3. **Translation:** Uses Claude Code to translate while preserving structure.
4. **File modification:**
   - Updates `displayed_sidebar: docsEnglish` → `docsJapanese`.
   - Adds translation banner after the title.
   - Fixes anchor links to match Japanese headings.
5. **PR creation:** Creates new PR with metadata from original.

### File path mapping

Original files are mapped to Japanese equivalents:

```text
docs/guides/getting-started.md → docs/ja-jp/guides/getting-started.md
docs/api/reference.mdx → docs/ja-jp/api/reference.mdx
README.md → docs/ja-jp/README.md
```

## Configuration

### Environment variables

Set these in the workflow or repository secrets:

```yaml
env:
  ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}  # Required
  GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}            # Auto-provided
```

### Workflow inputs

Customize behavior by modifying the configuration in `translate-markdown.js`:

```javascript
this.config = {
  targetLanguage: 'ja-jp',
  sidebarMapping: {
    'docsEnglish': 'docsJapanese'
  },
  translationBannerPath: '/src/components/_translation-ja-jp.mdx',
  fileExtensions: ['.md', '.mdx']
};
```

### Sidebar mapping

Add more sidebar mappings as needed:

```javascript
sidebarMapping: {
  'docsEnglish': 'docsJapanese',
  'apiEnglish': 'apiJapanese',
  'guidesEnglish': 'guidesJapanese'
}
```

## Translation quality

### Best practices

The workflow ensures high-quality translations by:

- **Preserving structure:** All Markdown formatting is maintained exactly.
- **Technical terms:** Code blocks and technical commands remain untranslated.
- **Natural language:** Claude Code provides contextually appropriate Japanese.
- **Consistency:** Translation banner and front-matter updates are standardized.

### What gets translated

✅ **Translated:**

- Heading text
- Body paragraphs
- List items
- Link text
- Alt text for images
- Table content

❌ **Not translated:**

- Code blocks and inline code
- URLs and file paths
- Front-matter property names
- Technical commands
- Repository names

## Troubleshooting

### Common issues

#### 1. Authentication error

```text
Error: Claude Code CLI not found
```

- Ensure `ANTHROPIC_API_KEY` secret is set correctly.
- Check API key has sufficient credits.

#### 2. Translation timeout

```text
Error: Claude Code translation timed out
```

- Large files may timeout; consider splitting content.
- Check Anthropic service status.

#### 3. Git push failures

```text
Error: failed to push some refs
```

- Check repository permissions.
- Ensure `GITHUB_TOKEN` has write access.

#### 4. Missing dependencies

```text
Error: Cannot find module '@actions/core'
```

- Verify `package.json` includes all dependencies.
- Check Node.js version compatibility.

### Debugging

Enable verbose logging by adding to workflow:

```yaml
- name: Enable debug logging
  run: echo "ACTIONS_STEP_DEBUG=true" >> $GITHUB_ENV
```

Check workflow logs for detailed error information and translation progress.

## Examples

### Example PR description

When the workflow creates a translation PR, it includes:

```markdown
## 🌐 Japanese translation

This PR contains automatic Japanese translations generated from the content merged in PR #123.

### 📁 Translated files
- `docs/ja-jp/guides/getting-started.md` (from `docs/guides/getting-started.md`)
- `docs/ja-jp/api/reference.mdx` (from `docs/api/reference.mdx`)

### 🔗 Source

- **Original PR:** #123 - Add new getting started guide
- **Author:** @johndoe
- **Branch:** `feature/new-guide`

### 🤖 Translation details

- **Target language:** Japanese (ja-jp)
- **Translation method:** Claude Code (Anthropic)
- **Translation banner:** Added to all translated files
- **Sidebar:** Updated from "docsEnglish" to "docsJapanese"
- **Anchor links:** Updated to match Japanese headings
```

### Example front matter changes

**Before (English):**
```yaml
---
title: Getting Started Guide
displayed_sidebar: docsEnglish
description: Learn how to get started
---
```

**After (Japanese):**
```yaml
---
title: Getting Started Guide
displayed_sidebar: docsJapanese
description: Learn how to get started
translated: true
translation_source: claude-code
translation_date: 2025-06-30
---
```

## Contributing

### Local development

1. Clone the repository.
2. Install dependencies: `npm install`.
3. Set environment variables:

   ```bash
   export ANTHROPIC_API_KEY="your-api-key"
   export GITHUB_TOKEN="your-github-token"
   ```

4. Test individual components:

   ```bash
   node claude-code-translator.js
   node file-processor.js
   ```

### Testing

Test the workflow with sample content:

```bash
# Test translation
echo "# Test Content\nThis is a test." > test.md
node translate-markdown.js
```

### Extending

To add support for other languages:

1. Update `targetLanguage` configuration.
2. Create appropriate translation banner components.
3. Modify sidebar mappings.
4. Update file path generation logic.

## License

MIT License. Feel free to use and modify for your projects.

## Support

For issues or questions:

1. Check the [troubleshooting section](#troubleshooting).
2. Review workflow logs for detailed error information.
3. Open an issue with reproduction steps.

---

**Happy translating! 🌐✨**
