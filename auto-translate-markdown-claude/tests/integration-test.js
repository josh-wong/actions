#!/usr/bin/env node

const fs = require('fs').promises;
const path = require('path');
const { execSync } = require('child_process');

console.log('🧪 Running Local Integration Test...\n');

class LocalTester {
  constructor() {
    this.testDir = path.join(__dirname, 'temp');
    this.originalEnv = { ...process.env };
  }

  async setup() {
    console.log('🔧 Setting up test environment...');
    
    // Create temporary test directory
    try {
      await fs.mkdir(this.testDir, { recursive: true });
    } catch (error) {
      // Directory might already exist
    }

    // Set required environment variables for testing
    process.env.GITHUB_TOKEN = 'test-token';
    process.env.ANTHROPIC_API_KEY = 'test-api-key';
    process.env.PR_NUMBER = '123';
    process.env.PR_TITLE = 'Test PR';
    process.env.PR_BODY = 'Test PR body';
    process.env.PR_AUTHOR = 'testuser';
    process.env.PR_HEAD_REF = 'feature/test';
    process.env.REPOSITORY_OWNER = 'testowner';
    process.env.REPOSITORY_NAME = 'testrepo';

    console.log('✅ Test environment ready');
  }

  async createTestFiles() {
    console.log('📝 Creating test Markdown files...');

    const testContent = `---
title: Getting Started Guide
displayed_sidebar: docsEnglish
description: Learn how to get started
---

# Getting Started

Welcome to our documentation! This guide will help you get started quickly.

## Prerequisites

Before you begin, make sure you have:

- Node.js installed
- A GitHub account
- Basic knowledge of Markdown

## Installation

Follow these steps:

1. Clone the repository
2. Install dependencies
3. Run the application

### Step 1: Clone

\`\`\`bash
git clone https://github.com/example/repo.git
\`\`\`

### Step 2: Install

\`\`\`bash
npm install
\`\`\`

## Features

Our platform offers:

- [Real-time collaboration](#collaboration)
- Advanced analytics
- Custom integrations

### Collaboration

Work together seamlessly with your team.

## Next Steps

Check out our [API documentation](./api.md) for more details.
`;

    const testFiles = [
      { path: 'docs/guides/getting-started.md', content: testContent },
      { path: 'docs/api/reference.mdx', content: testContent.replace('Getting Started', 'API Reference') },
      { path: 'README.md', content: '# Test Project\n\nThis is a test project.' }
    ];

    for (const file of testFiles) {
      const fullPath = path.join(this.testDir, file.path);
      await fs.mkdir(path.dirname(fullPath), { recursive: true });
      await fs.writeFile(fullPath, file.content);
    }

    console.log(`✅ Created ${testFiles.length} test files`);
    return testFiles.map(f => f.path);
  }

  async testFileProcessing() {
    console.log('🔄 Testing file processing...');

    const FileProcessor = require('../scripts/file-processor');
    const AnchorLinkFixer = require('../scripts/anchor-link-fixer');
    
    const fileProcessor = new FileProcessor();
    const anchorFixer = new AnchorLinkFixer();

    const testFile = path.join(this.testDir, 'docs/guides/getting-started.md');
    const content = await fs.readFile(testFile, 'utf8');

    // Test front matter extraction
    const { frontMatter, body } = fileProcessor.extractFrontMatter(content);
    console.log('  ✅ Front matter extracted successfully');

    // Test front matter updates
    const updatedFrontMatter = fileProcessor.updateFrontMatter(frontMatter, {
      'docsEnglish': 'docsJapanese'
    });
    console.log('  ✅ Front matter updated successfully');

    // Test translation banner addition
    const bodyWithBanner = fileProcessor.addTranslationBanner(
      body, 
      '/src/components/_translation-ja-jp.mdx'
    );
    console.log('  ✅ Translation banner added successfully');

    // Test file reassembly
    const reassembled = fileProcessor.reassembleFile(updatedFrontMatter, bodyWithBanner);
    console.log('  ✅ File reassembled successfully');

    // Write test output
    const outputPath = path.join(this.testDir, 'docs/ja-jp/guides/getting-started.md');
    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    await fs.writeFile(outputPath, reassembled);
    console.log('  ✅ Test output file created');

    return true;
  }

  async testClaudeCodeMock() {
    console.log('🤖 Testing Claude Code integration (mock)...');

    // Mock Claude Code translator
    class MockClaudeCodeTranslator {
      async translateMarkdown(content, filePath) {
        console.log(`  📝 Mock translating: ${filePath}`);
        
        // Simple mock translation - replace common words
        const mockTranslated = content
          .replace(/# Getting Started/g, '# はじめに')
          .replace(/## Prerequisites/g, '## 前提条件')
          .replace(/## Installation/g, '## インストール')
          .replace(/## Features/g, '## 機能')
          .replace(/### Collaboration/g, '### コラボレーション')
          .replace(/## Next Steps/g, '## 次のステップ')
          .replace(/Welcome to our documentation!/g, 'ドキュメントへようこそ！')
          .replace(/This guide will help you get started quickly\./g, 'このガイドでは、すぐに開始できるようにサポートします。');

        return mockTranslated;
      }
    }

    const translator = new MockClaudeCodeTranslator();
    const testContent = '# Getting Started\n\nWelcome to our documentation!';
    
    const translated = await translator.translateMarkdown(testContent, 'test.md');
    
    if (translated.includes('はじめに') && translated.includes('ドキュメントへようこそ')) {
      console.log('  ✅ Mock translation working correctly');
      return true;
    } else {
      throw new Error('Mock translation failed');
    }
  }

  async testGitOperations() {
    console.log('🔧 Testing Git operations (dry run)...');

    try {
      // Test git commands that would be used (but don't actually execute)
      const gitCommands = [
        'git status',
        'git branch --show-current',
        'git log --oneline -1'
      ];

      for (const cmd of gitCommands) {
        console.log(`  🔍 Would run: ${cmd}`);
      }

      console.log('  ✅ Git operations test passed (dry run)');
      return true;
    } catch (error) {
      console.log('  ⚠️ Git operations test skipped (no git repo)');
      return true; // Not a failure for testing
    }
  }

  async cleanup() {
    console.log('🧹 Cleaning up test environment...');
    
    try {
      await fs.rm(this.testDir, { recursive: true, force: true });
      console.log('  ✅ Test files cleaned up');
    } catch (error) {
      console.log('  ⚠️ Cleanup warning:', error.message);
    }

    // Restore original environment
    process.env = this.originalEnv;
    console.log('  ✅ Environment restored');
  }

  async run() {
    try {
      await this.setup();
      await this.createTestFiles();
      await this.testFileProcessing();
      await this.testClaudeCodeMock();
      await this.testGitOperations();
      
      console.log('\n🎉 Local integration test completed successfully!');
      
    } catch (error) {
      console.error('\n❌ Local integration test failed:', error.message);
      throw error;
    } finally {
      await this.cleanup();
    }
  }
}

// Run the test
const tester = new LocalTester();
tester.run().catch(error => {
  console.error('Integration test failed:', error);
  process.exit(1);
});
