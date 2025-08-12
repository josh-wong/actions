# Auto-Translation Workflows - Clean Setup

## 🎯 Final Configuration

We now have a clean, focused auto-translation setup with just **2 workflows**:

### 1. **Automatic Translation** (`auto-translate-documentation.yml`)
- **Trigger**: When documentation PRs are **merged** (not just opened)
- **Function**: Automatically translates changed docs from `docs/en-us/` to `docs/ja-jp/`
- **Technology**: Official Claude Code GitHub Action

### 2. **Manual Translation** (`claude-translation-assistant.yml`)  
- **Trigger**: Comment `@claude translate docs` on any PR/issue
- **Function**: On-demand translation with specific instructions
- **Technology**: Official Claude Code GitHub Action

## 🚀 Usage

### Automatic (Recommended)
1. Edit documentation files in `docs/en-us/`
2. Create and **merge** your PR
3. Translation workflow automatically runs after merge
4. Japanese translations appear in `docs/ja-jp/`

### Manual (When Needed)
1. Comment `@claude translate docs` on any PR/issue
2. Claude translates available documentation
3. Translations are committed to the current branch

## 🔧 Setup Required

### 1. Authentication
Add `ANTHROPIC_API_KEY` to your repository secrets:
- Go to Settings → Secrets and variables → Actions
- Add secret: `ANTHROPIC_API_KEY` = your Claude API key

### 2. Repository Permissions
Workflows need these permissions (already configured):
```yaml
permissions:
  contents: write        # Modify files
  pull-requests: write   # Update PRs
  issues: write         # Comment on issues  
  id-token: write       # OIDC authentication
```

## ✅ Key Features

- **Runs only on merged PRs** - No unnecessary runs on draft/WIP PRs
- **Official Claude Code Action** - Reliable, maintained by Anthropic
- **Preserves formatting** - MDX/Markdown structure maintained exactly
- **Professional Japanese** - Natural, technical translation quality
- **UTF-8 compatible** - Proper encoding for Japanese characters
- **Manual override** - Comment-triggered for specific needs

## 🧹 Cleanup Completed

**Removed redundant workflows:**
- ❌ `auto-translate-docs-automation.yml` (duplicate)
- ❌ `auto-translate-markdown-claude-official.yml` (duplicate)  
- ❌ `auto-translate-markdown-reusable.yaml` (old OpenAI version)
- ❌ `test-claude-setup.yml` (not needed)

**Kept essential workflows:**
- ✅ `auto-translate-documentation.yml` (automatic on merge)
- ✅ `claude-translation-assistant.yml` (manual translation)

## 🎉 Benefits of Clean Setup

1. **No confusion** - Clear purpose for each workflow
2. **No redundancy** - Each workflow has a distinct use case  
3. **Efficient** - Only runs when actually needed (after merge)
4. **Maintainable** - Simple, focused configuration
5. **Official** - Uses supported Claude Code Action

**Ready to go!** 🚀 Merge a documentation PR to see automatic translation in action.
