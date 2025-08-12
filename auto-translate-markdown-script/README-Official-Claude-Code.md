# Auto-Translate Markdown Script

## Official Claude Code Action Implementation

This implementation now uses the official [Claude Code GitHub Action](https://github.com/anthropics/claude-code-action) instead of custom CLI scripts, providing more reliable authentication and better integration with GitHub.

## Setup Instructions

### 1. Install Claude GitHub App (Recommended)
The easiest setup method:
1. Open Claude Code in terminal: `claude`
2. Run: `/install-github-app`
3. Follow the guided setup to install the GitHub app and configure secrets

### 2. Manual Setup (Alternative)
If you prefer manual setup:
1. Go to https://github.com/apps/claude and install the Claude app to your repository
2. Add your API key to repository secrets:
   - Go to Settings → Secrets and variables → Actions
   - Add secret: `ANTHROPIC_API_KEY` with your API key value

## Available Workflows

### 1. Automatic Translation on PR Changes
**File**: `.github/workflows/auto-translate-docs-automation.yml`
- **Trigger**: Automatically runs when English docs are modified in PRs
- **Function**: Translates changed files from `docs/en-us/` to `docs/ja-jp/`
- **Mode**: Uses `agent` mode for automated processing

### 2. Comment-Triggered Translation Assistant  
**File**: `.github/workflows/claude-translation-assistant.yml`
- **Trigger**: Manual trigger using `@claude translate docs` in PR/issue comments
- **Function**: Interactive translation with Claude assistance
- **Benefits**: More control and ability to give specific instructions

### 3. Direct PR Integration
**File**: `.github/workflows/auto-translate-markdown-claude-official.yml`
- **Trigger**: PR opened/synchronized with doc changes
- **Function**: Direct translation using `direct_prompt`
- **Benefits**: Immediate automated translation without manual intervention

## Usage Examples

### Automatic Translation
1. Create/modify any `.md` or `.mdx` file in `docs/en-us/`
2. Open a pull request
3. The workflow automatically detects changes and creates Japanese translations
4. Translations appear in `docs/ja-jp/` with the same directory structure

### Manual Translation
1. Comment on any PR or issue: `@claude translate docs`
2. Claude will analyze the repository and translate available documentation
3. You can give specific instructions like: `@claude translate the new API documentation to Japanese`

## Key Features

### Authentication
- Uses official Claude GitHub App authentication
- OIDC token exchange for secure communication
- No custom token management required

### File Processing
- Preserves MDX/Markdown formatting exactly
- Maintains directory structure
- Keeps code blocks and technical terms in English
- Ensures proper UTF-8 encoding for Japanese text

### Quality Standards
- Professional, natural Japanese translation
- Technical accuracy maintained
- All links and references preserved
- Proper commit messages and PR integration

## Troubleshooting

### Authentication Issues
1. Ensure the Claude GitHub App is installed on your repository
2. Verify `ANTHROPIC_API_KEY` is set in repository secrets
3. Check that workflows have proper permissions (contents: write, pull-requests: write, etc.)

### Translation Quality
- Claude maintains formatting and technical accuracy
- Code blocks and URLs remain unchanged
- File structure mirrors the English documentation
- UTF-8 encoding ensures proper Japanese character display

### Workflow Permissions
The workflows require these permissions:
```yaml
permissions:
  contents: write
  pull-requests: write
  issues: write
  id-token: write  # Required for OIDC authentication
```

## Migration from Custom CLI

If migrating from the previous custom CLI implementation:
1. The official Claude Code Action provides better authentication
2. More reliable GitHub integration
3. Better error handling and logging
4. Official support and updates from Anthropic

## Benefits of Official Implementation

1. **Security**: Official GitHub App with proper OIDC authentication
2. **Reliability**: Maintained by Anthropic with regular updates
3. **Features**: Access to latest Claude Code capabilities
4. **Support**: Official documentation and community support
5. **Integration**: Native GitHub Actions integration

For more information, see the [official Claude Code documentation](https://docs.anthropic.com/en/docs/claude-code/github-actions).
