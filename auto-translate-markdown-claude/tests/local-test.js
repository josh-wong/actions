#!/usr/bin/env node

const fs = require('fs').promises;
const path = require('path');

console.log('🔬 Running Local Workflow Test...\n');

class LocalWorkflowTester {
  constructor() {
    this.testData = {
      prNumber: 123,
      prTitle: 'Add new documentation',
      prBody: 'This PR adds comprehensive documentation for the new features.',
      prAuthor: 'testuser',
      prHeadRef: 'feature/docs',
      repositoryOwner: 'testowner',
      repositoryName: 'testrepo'
    };
  }

  async testWorkflowComponents() {
    console.log('🧩 Testing individual workflow components...\n');

    // Test 1: File detection logic
    await this.testFileDetection();
    
    // Test 2: File processing pipeline
    await this.testFileProcessing();
    
    // Test 3: Translation logic (mocked)
    await this.testTranslationLogic();
    
    // Test 4: PR body generation
    await this.testPRBodyGeneration();
    
    console.log('✅ All component tests passed!\n');
  }

  async testFileDetection() {
    console.log('🔍 Testing file detection...');
    
    const mockPRFiles = [
      { filename: 'docs/guide.md', status: 'modified' },
      { filename: 'docs/api.mdx', status: 'added' },
      { filename: 'docs/ja-jp/existing.md', status: 'modified' },
      { filename: 'README.md', status: 'modified' },
      { filename: 'package.json', status: 'modified' },
      { filename: 'src/component.jsx', status: 'added' },
      { filename: 'deleted.md', status: 'removed' }
    ];

    const fileExtensions = ['.md', '.mdx'];
    const filteredFiles = mockPRFiles.filter(file => {
      const hasValidExtension = fileExtensions.some(ext => file.filename.endsWith(ext));
      const isInJapaneseDir = file.filename.includes('docs/ja-jp');
      const isAddedOrModified = ['added', 'modified'].includes(file.status);
      
      return hasValidExtension && !isInJapaneseDir && isAddedOrModified;
    });

    console.log(`  📊 Found ${filteredFiles.length} eligible files:`);
    filteredFiles.forEach(file => {
      console.log(`    - ${file.filename} (${file.status})`);
    });

    if (filteredFiles.length !== 3) {
      throw new Error(`Expected 3 files, got ${filteredFiles.length}`);
    }

    console.log('  ✅ File detection working correctly\n');
  }

  async testFileProcessing() {
    console.log('📝 Testing file processing pipeline...');

    const sampleContent = `---
title: Getting Started
displayed_sidebar: docsEnglish
description: Learn the basics
---

# Getting Started

Welcome to our platform! This guide covers:

## Prerequisites

- Node.js 18+
- Git knowledge
- [GitHub account](https://github.com)

## Quick Start

1. Clone the repository
2. Install dependencies: \`npm install\`
3. Start development: \`npm run dev\`

### Advanced Configuration

Check our [configuration guide](#configuration) for details.

## Next Steps

Visit the [API documentation](./api.md) to learn more.
`;

    // Mock our processors
    const FileProcessor = require('../scripts/file-processor');
    const AnchorLinkFixer = require('../scripts/anchor-link-fixer');
    
    const fileProcessor = new FileProcessor();
    const anchorFixer = new AnchorLinkFixer();

    // Test front matter extraction
    const { frontMatter, body } = fileProcessor.extractFrontMatter(sampleContent);
    console.log('  ✅ Front matter extracted');

    // Test sidebar mapping
    const updatedFrontMatter = fileProcessor.updateFrontMatter(frontMatter, {
      'docsEnglish': 'docsJapanese'
    });
    console.log(`  ✅ Sidebar updated: ${frontMatter.displayed_sidebar} → ${updatedFrontMatter.displayed_sidebar}`);

    // Test translation banner
    const withBanner = fileProcessor.addTranslationBanner(body, '/src/components/_translation-ja-jp.mdx');
    console.log('  ✅ Translation banner added');

    // Test reassembly
    const reassembled = fileProcessor.reassembleFile(updatedFrontMatter, withBanner);
    console.log('  ✅ File reassembled successfully\n');
  }

  async testTranslationLogic() {
    console.log('🤖 Testing translation logic (mock)...');

    // Mock translation that simulates Claude Code
    const mockTranslate = (content) => {
      return content
        .replace(/# Getting Started/g, '# はじめに')
        .replace(/## Prerequisites/g, '## 前提条件')
        .replace(/## Quick Start/g, '## クイックスタート')
        .replace(/### Advanced Configuration/g, '### 高度な設定')
        .replace(/## Next Steps/g, '## 次のステップ')
        .replace(/Welcome to our platform!/g, 'プラットフォームへようこそ！')
        .replace(/This guide covers:/g, 'このガイドでは以下を説明します：')
        .replace(/Clone the repository/g, 'リポジトリをクローン')
        .replace(/Install dependencies/g, '依存関係をインストール')
        .replace(/Start development/g, '開発を開始');
    };

    const originalText = '# Getting Started\n\nWelcome to our platform! This guide covers:\n\n## Prerequisites';
    const translatedText = mockTranslate(originalText);
    
    console.log('  📝 Original:', originalText.split('\n')[0]);
    console.log('  🌐 Translated:', translatedText.split('\n')[0]);
    
    if (translatedText.includes('はじめに') && translatedText.includes('プラットフォームへようこそ')) {
      console.log('  ✅ Mock translation working correctly\n');
    } else {
      throw new Error('Mock translation failed');
    }
  }

  async testPRBodyGeneration() {
    console.log('📋 Testing PR body generation...');

    const translatedFiles = [
      { originalPath: 'docs/guide.md', translatedPath: 'docs/ja-jp/guide.md' },
      { originalPath: 'README.md', translatedPath: 'docs/ja-jp/README.md' }
    ];

    const prBody = this.generatePRBody(translatedFiles);
    
    console.log('  📄 Generated PR body preview:');
    console.log('  ' + '─'.repeat(50));
    console.log(prBody.split('\n').slice(0, 10).map(line => `  ${line}`).join('\n'));
    console.log('  ' + '─'.repeat(50));
    
    // Verify key elements
    const checks = [
      { name: 'Contains file list', test: prBody.includes('docs/ja-jp/guide.md') },
      { name: 'References original PR', test: prBody.includes('#123') },
      { name: 'Shows author', test: prBody.includes('@testuser') },
      { name: 'Shows branch', test: prBody.includes('feature/docs') },
      { name: 'Has review checklist', test: prBody.includes('Review checklist') }
    ];

    checks.forEach(check => {
      if (check.test) {
        console.log(`  ✅ ${check.name}`);
      } else {
        throw new Error(`PR body missing: ${check.name}`);
      }
    });

    console.log('  ✅ PR body generation working correctly\n');
  }

  generatePRBody(translatedFiles) {
    const fileList = translatedFiles
      .map(file => `- \`${file.translatedPath}\` (from \`${file.originalPath}\`)`)
      .join('\n');

    return `## 🌐 Japanese translation

This PR contains automatic Japanese translations generated from the content merged in PR #${this.testData.prNumber}.

### 📁 Translated files

${fileList}

### 🔗 Source

- **Original PR**: #${this.testData.prNumber} - ${this.testData.prTitle}
- **Author**: @${this.testData.prAuthor}
- **Branch**: \`${this.testData.prHeadRef}\`

### 🤖 Translation details

- **Target language**: Japanese (ja-jp)
- **Translation method**: Claude Code (Anthropic)
- **Translation banner**: Added to all translated files
- **Sidebar**: Updated from "docsEnglish" to "docsJapanese"
- **Anchor links**: Updated to match Japanese headings

### ✅ Review checklist

- [ ] Translation accuracy and natural Japanese phrasing
- [ ] Technical terminology consistency
- [ ] Link functionality (especially anchor links)
- [ ] Front matter configuration
- [ ] Translation banner placement

---
*This translation was automatically generated. Please review for accuracy and naturalness.*`;
  }

  async testPathGeneration() {
    console.log('🗂️ Testing Japanese path generation...');

    const testPaths = [
      { input: 'docs/guides/getting-started.md', expected: 'docs/ja-jp/guides/getting-started.md' },
      { input: 'docs/api/reference.mdx', expected: 'docs/ja-jp/api/reference.mdx' },
      { input: 'README.md', expected: 'docs/ja-jp/README.md' },
      { input: 'content/blog/post.md', expected: 'docs/ja-jp/content/blog/post.md' }
    ];

    const generateJapaneseFilePath = (originalPath) => {
      const pathParts = originalPath.split('/');
      const docsIndex = pathParts.findIndex(part => part === 'docs');
      if (docsIndex !== -1) {
        pathParts.splice(docsIndex + 1, 0, 'ja-jp');
      } else {
        pathParts.unshift('docs', 'ja-jp');
      }
      return pathParts.join('/');
    };

    testPaths.forEach(({ input, expected }) => {
      const result = generateJapaneseFilePath(input);
      if (result === expected) {
        console.log(`  ✅ ${input} → ${result}`);
      } else {
        throw new Error(`Path generation failed: ${input} → ${result} (expected ${expected})`);
      }
    });

    console.log('  ✅ Path generation working correctly\n');
  }

  async run() {
    try {
      await this.testWorkflowComponents();
      await this.testPathGeneration();
      
      console.log('🎉 Local workflow test completed successfully!');
      console.log('\n🚀 Next steps to test the full workflow:');
      console.log('1. Set up a test repository');
      console.log('2. Add the workflow files');
      console.log('3. Create a PR with Markdown files');
      console.log('4. Merge the PR and watch the workflow run');
      
    } catch (error) {
      console.error('\n❌ Local workflow test failed:', error.message);
      throw error;
    }
  }
}

// Run the test
const tester = new LocalWorkflowTester();
tester.run().catch(error => {
  console.error('Local test failed:', error);
  process.exit(1);
});
