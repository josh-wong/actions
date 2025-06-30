# Sample Usage Configuration for Auto-Translate Markdown

This file shows example configurations for different repository setups.

## Basic Configuration

For calling this workflow from another repository:

```yaml
# .github/workflows/auto-translate-markdown.yml
name: Auto-Translate Markdown to Japanese

on:
  pull_request:
    types: [closed]
    paths:
      - 'docs/en-us/**/*.md'
      - 'docs/en-us/**/*.mdx'

jobs:
  translate-markdown:
    if: github.event.pull_request.merged == true
    uses: josh-wong/actions/.github/workflows/auto-translate-markdown-claude-reusable.yml@main
    secrets:
      ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
```

### Alternative: Self-contained workflow

If you want to copy the workflow files directly to your repository:

```yaml
# .github/workflows/auto-translate-markdown.yml
name: Auto-Translate Markdown to Japanese

on:
  pull_request:
    types: [closed]
    paths:
      - 'docs/en-us/**/*.md'
      - 'docs/en-us/**/*.mdx'

jobs:
  translate-markdown:
    if: github.event.pull_request.merged == true
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
          token: ${{ secrets.GITHUB_TOKEN }}
          
      - uses: actions/checkout@v4
        with:
          repository: josh-wong/actions
          path: .actions
          
      - uses: actions/setup-node@v4
        with:
          node-version: '18'
      
      - name: Run translation
        env:
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          PR_NUMBER: ${{ github.event.pull_request.number }}
          PR_TITLE: ${{ github.event.pull_request.title }}
          PR_BODY: ${{ github.event.pull_request.body }}
          PR_AUTHOR: ${{ github.event.pull_request.user.login }}
          PR_HEAD_REF: ${{ github.event.pull_request.head.ref }}
          REPOSITORY_OWNER: ${{ github.repository_owner }}
          REPOSITORY_NAME: ${{ github.event.repository.name }}
        run: |
          cd .actions/auto-translate-markdown-claude
          npm install
          npm install -g @anthropic-ai/claude-code
          node scripts/translate-markdown.js
```

## Usage Options

### Option 1: Reusable Workflow (Recommended)
- ✅ **Easier to maintain**: Updates happen automatically when the source workflow is updated
- ✅ **Cleaner**: Minimal configuration in your repository
- ✅ **Centralized**: All logic stays in the actions repository

### Option 2: Self-contained Workflow
- ✅ **Full control**: You can modify the workflow for your specific needs
- ✅ **No dependencies**: Works even if the source repository is unavailable
- ❌ **Maintenance overhead**: You need to manually update when improvements are made
```

## Advanced Configuration

For repositories with multiple documentation sections:

```javascript
// translate-markdown.js configuration
this.config = {
  targetLanguage: 'ja-jp',
  sidebarMapping: {
    'docsEnglish': 'docsJapanese',
    'apiEnglish': 'apiJapanese',
    'guidesEnglish': 'guidesJapanese',
    'tutorialsEnglish': 'tutorialsJapanese'
  },
  translationBannerPath: '/src/components/_translation-ja-jp.mdx',
  fileExtensions: ['.md', '.mdx', '.markdown'],
  excludePaths: [
    'docs/ja-jp',
    'docs/internal',
    'CHANGELOG.md',
    'CONTRIBUTING.md'
  ],
  maxFileSize: 100000, // 100KB limit
  batchSize: 5 // Process 5 files at a time
};
```

## Multi-Language Support

To support multiple target languages:

```javascript
// Multi-language configuration example
const configs = {
  'ja-jp': {
    targetLanguage: 'ja-jp',
    sidebarMapping: { 'docsEnglish': 'docsJapanese' },
    translationBannerPath: '/src/components/_translation-ja-jp.mdx',
    branchSuffix: 'ja-jp'
  },
  'es-es': {
    targetLanguage: 'es-es', 
    sidebarMapping: { 'docsEnglish': 'docsSpanish' },
    translationBannerPath: '/src/components/_translation-es-es.mdx',
    branchSuffix: 'es-es'
  },
  'fr-fr': {
    targetLanguage: 'fr-fr',
    sidebarMapping: { 'docsEnglish': 'docsFrench' },
    translationBannerPath: '/src/components/_translation-fr-fr.mdx', 
    branchSuffix: 'fr-fr'
  }
};
```

## Repository Secrets Setup

Required secrets in repository settings:

```bash
# GitHub repository secrets
ANTHROPIC_API_KEY=sk-ant-api03-...  # Your Anthropic API key for Claude Code

# Note: GITHUB_TOKEN is automatically provided by GitHub Actions
# and does not need to be manually configured
```

## File Structure Examples

### Nextra Documentation Site

```
docs/
├── getting-started.md              # English source
├── api/
│   ├── authentication.md
│   └── endpoints.mdx
├── ja-jp/                          # Japanese translations
│   ├── getting-started.md
│   └── api/
│       ├── authentication.md
│       └── endpoints.mdx
└── _meta.json                      # Nextra navigation
```

### Docusaurus Site

```markdown
docs/
├── intro.md                        # English source
├── tutorial-basics/
│   ├── create-a-page.md
│   └── deploy-your-site.md
├── ja-jp/                          # Japanese translations
│   ├── intro.md
│   └── tutorial-basics/
│       ├── create-a-page.md
│       └── deploy-your-site.md
└── sidebars.js                     # Docusaurus sidebar config
```

## Translation Banner Examples

### Basic Banner (MDX)

```markdown
import TranslationBanner from '/src/components/_translation-ja-jp.mdx';

<TranslationBanner />
```

### Advanced Banner with Links

```markdown
import TranslationBanner from '/src/components/_translation-ja-jp.mdx';

<TranslationBanner />
```

## Conditional Workflow Triggers

### Development vs Production

```yaml
# Only run on main branch merges
on:
  pull_request:
    types: [closed]
    branches: [main, master]
    paths: ['docs/**/*.md', 'docs/**/*.mdx']

# Or run on specific labels
on:
  pull_request:
    types: [closed, labeled]

jobs:
  translate-markdown:
    if: |
      github.event.pull_request.merged == true &&
      contains(github.event.pull_request.labels.*.name, 'translate')
```

### Path-based Filtering

```yaml
# Only translate specific directories
on:
  pull_request:
    types: [closed]
    paths:
      - 'docs/guides/**/*.md'
      - 'docs/api/**/*.mdx'
      - '!docs/internal/**'        # Exclude internal docs
      - '!docs/ja-jp/**'           # Exclude existing translations
```

## Error Handling Examples

### Graceful Failure

```javascript
// Enhanced error handling in translate-markdown.js
async run() {
  try {
    await this.executeWorkflow();
  } catch (error) {
    await this.handleFailure(error);
    // Don't re-throw to prevent workflow failure
  }
}

async handleFailure(error) {
  // Log detailed error
  console.error('Translation workflow failed:', error);
  
  // Comment on original PR
  await this.octokit.rest.issues.createComment({
    issue_number: this.config.prNumber,
    body: this.generateErrorComment(error)
  });
  
  // Send notification (optional)
  await this.notifyMaintainers(error);
}
```

### Partial Success Handling

```javascript
// Handle partial translation success
async translateFiles(filePaths) {
  const results = {
    successful: [],
    failed: []
  };
  
  for (const filePath of filePaths) {
    try {
      await this.translateSingleFile(filePath);
      results.successful.push(filePath);
    } catch (error) {
      results.failed.push({ filePath, error: error.message });
    }
  }
  
  if (results.successful.length > 0) {
    await this.createPartialTranslationPR(results);
  }
  
  return results;
}
```

## Performance Optimization

### Batch Processing

```javascript
// Process files in batches to avoid rate limits
async translateFilesBatch(filePaths, batchSize = 3) {
  const batches = [];
  for (let i = 0; i < filePaths.length; i += batchSize) {
    batches.push(filePaths.slice(i, i + batchSize));
  }
  
  const results = [];
  for (const batch of batches) {
    const batchResults = await Promise.allSettled(
      batch.map(file => this.translateSingleFile(file))
    );
    results.push(...batchResults);
    
    // Wait between batches to respect rate limits
    await this.sleep(2000);
  }
  
  return results;
}
```

### Caching Strategy

```javascript
// Cache translations to avoid re-translating unchanged content
const crypto = require('crypto');

class TranslationCache {
  generateContentHash(content) {
    return crypto.createHash('sha256').update(content).digest('hex');
  }
  
  async getCachedTranslation(contentHash) {
    // Check if translation exists in cache
    // Could use GitHub cache, filesystem, or external service
  }
  
  async setCachedTranslation(contentHash, translation) {
    // Store translation in cache
  }
}
```

## Testing and Validation

### Local Testing Script

```bash
#!/bin/bash
# test-translation.sh

# Set up test environment
export ANTHROPIC_API_KEY="your-test-api-key"
export GITHUB_TOKEN="your-test-token"
export PR_NUMBER="123"
export PR_TITLE="Test Translation"
export PR_AUTHOR="testuser"
export PR_HEAD_REF="test-branch"
export REPOSITORY_OWNER="testorg"
export REPOSITORY_NAME="testrepo"

# Create test markdown file
echo "# Test Document
This is a test document for translation.

## Section 1
Some content here.

[Link to section](#section-1)
" > test-doc.md

# Run translation
cd auto-translate-markdown
npm install
node translate-markdown.js

echo "Translation test completed!"
```

### Validation Checklist

- [ ] Front matter properly updated
- [ ] Translation banner added
- [ ] Anchor links working
- [ ] Code blocks preserved
- [ ] File structure correct
- [ ] PR metadata applied
- [ ] Error handling works
- [ ] Rate limiting respected

This configuration guide should help you customize the auto-translation workflow for your specific repository needs!
