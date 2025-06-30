# Auto-Translate Markdown with Claude Feature

## Overview

The Auto-Translate Markdown with Claude feature is a GitHub Actions workflow that automatically translates English Markdown documentation to Japanese when pull requests are merged. It leverages Claude Code (Anthropic's AI) to create high-quality translations while preserving the structure and formatting of technical documentation.

## What It Does

This feature automatically:
- **Detects** new or modified Markdown files in merged pull requests
- **Translates** English content to natural, professional Japanese
- **Preserves** all Markdown formatting, code blocks, and technical elements
- **Updates** configuration for Japanese documentation structure
- **Creates** a new pull request with the translated content
- **Maintains** multilingual documentation websites with minimal manual intervention

## How It Works

### Workflow Trigger
The automation activates when:
- A pull request is **merged** (not just closed)
- The PR contains `.md` or `.mdx` files in English documentation directories
- Files are **added** or **modified** (not deleted)
- Can also be triggered manually for testing

### Translation Process

1. **File Detection**
   - Scans merged PR for eligible Markdown files
   - Filters for documentation files (excludes existing Japanese translations)
   - Identifies files that need translation

2. **Content Processing**
   - Extracts YAML front matter and content body separately
   - Preserves technical elements (code blocks, URLs, file paths)
   - Maintains document structure and formatting

3. **Claude Code Translation**
   - Uses Claude Code CLI with specialized prompts
   - Translates to natural, professional Japanese
   - Preserves ALL Markdown formatting exactly
   - Implements retry logic for reliability

4. **Japanese File Preparation**
   - Updates sidebar configuration (`docsEnglish` → `docsJapanese`)
   - Adds translation banner component
   - Fixes internal anchor links to match translated headings
   - Generates proper Japanese file paths

5. **Output Creation**
   - Creates new branch for Japanese translations
   - Generates files in `docs/ja-jp/` structure
   - Creates comprehensive pull request with metadata

## Key Features

### Smart Content Handling
- **Preserves**: Code blocks, URLs, technical commands, file paths
- **Translates**: Headings, paragraphs, lists, link text, descriptions
- **Maintains**: Document structure, formatting, and navigation

### Quality Assurance
- **Validation**: Ensures translation completeness and accuracy
- **Error Recovery**: Continues processing if individual files fail
- **Retry Logic**: Handles temporary API failures gracefully

### Documentation Integration
- **Sidebar Updates**: Automatically configures Japanese navigation
- **Translation Banners**: Adds user-facing translation notices
- **Anchor Links**: Updates internal links to match translated content

## File Structure

### Input (English)
```
docs/
└── en-us/
    └── guides/
        └── getting-started.md
```

### Output (Japanese)
```
docs/
├── en-us/
│   └── guides/
│       └── getting-started.md    # Original
└── ja-jp/
    └── guides/
        └── getting-started.md    # Translation
```

## Configuration Options

### Environment Requirements
- **ANTHROPIC_API_KEY**: Required for Claude Code authentication
- **GITHUB_TOKEN**: Auto-provided by GitHub Actions

### Customizable Settings
- Target language (default: Japanese)
- File extensions to process (`.md`, `.mdx`)
- Sidebar mapping configuration
- Translation banner component path

## Usage Options

### Option 1: Reusable Workflow (Recommended)
Add to your workflow file:

```yaml
name: Auto-translate merged PR content

on:
  pull_request:
    types: [closed]

jobs:
  translate-markdown:
    if: github.event.pull_request.merged == true
    uses: josh-wong/actions/.github/workflows/auto-translate-markdown-claude-reusable.yml@main
    secrets:
      ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
```

### Option 2: Self-contained Implementation
Copy the complete workflow and scripts to your repository for full customization control.

## Translation Quality

### What Gets Translated
✅ Document titles and headings  
✅ Body paragraphs and content  
✅ List items and descriptions  
✅ Link text and alt text  
✅ Table content  

### What Stays Unchanged
❌ Code blocks and syntax  
❌ URLs and file paths  
❌ Technical commands  
❌ Repository names  
❌ Front matter properties  

## Example Translation Output

### Before (English)
```markdown
---
title: Getting Started Guide
displayed_sidebar: docsEnglish
---

# Getting Started

Welcome to our documentation! Follow these steps:

1. Clone the repository: `git clone https://github.com/example/repo.git`
2. Install dependencies: `npm install`

Check our [API documentation](./api.md) for more details.
```

### After (Japanese)
```markdown
---
title: Getting Started Guide
displayed_sidebar: docsJapanese
translated: true
translation_source: claude-code
---

import TranslationBanner from '/src/components/_translation-ja-jp.mdx';

# はじめに

<TranslationBanner />

ドキュメントへようこそ！以下の手順に従ってください：

1. リポジトリをクローン: `git clone https://github.com/example/repo.git`
2. 依存関係をインストール: `npm install`

詳細については[API ドキュメント](./api.md)をご確認ください。
```

## Benefits

### For Development Teams
- **Automated Process**: No manual translation work required
- **Consistent Quality**: Professional, technical Japanese translations
- **Maintenance Free**: Automatically keeps translations up to date
- **Quality Control**: Preserves technical accuracy and formatting

### For Users
- **Natural Language**: Professional Japanese that reads naturally
- **Complete Documentation**: Full feature parity with English docs
- **Navigation Integration**: Properly configured Japanese sidebar and links
- **Translation Transparency**: Clear indication of translated content

## Performance

- **Batch Processing**: Handles multiple files efficiently
- **Rate Limiting**: Respects API limits for both Claude and GitHub
- **Error Handling**: Robust retry logic and failure recovery
- **Resource Management**: Automatic cleanup of temporary files

The Auto-Translate Markdown with Claude feature provides a comprehensive solution for maintaining multilingual technical documentation with enterprise-grade quality and reliability.