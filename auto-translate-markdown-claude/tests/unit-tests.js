#!/usr/bin/env node

const assert = require('assert');
const fs = require('fs').promises;
const path = require('path');

// Import our modules for testing
const FileProcessor = require('../scripts/file-processor');
const AnchorLinkFixer = require('../scripts/anchor-link-fixer');

console.log('🧪 Running Unit Tests...\n');

class UnitTester {
  constructor() {
    this.tests = [];
    this.passed = 0;
    this.failed = 0;
  }

  test(name, testFn) {
    this.tests.push({ name, testFn });
  }

  async run() {
    for (const { name, testFn } of this.tests) {
      try {
        console.log(`  🔍 ${name}`);
        await testFn();
        console.log(`  ✅ ${name} passed`);
        this.passed++;
      } catch (error) {
        console.log(`  ❌ ${name} failed: ${error.message}`);
        this.failed++;
      }
    }

    console.log(`\n📊 Unit Test Results:`);
    console.log(`✅ Passed: ${this.passed}`);
    console.log(`❌ Failed: ${this.failed}`);

    if (this.failed > 0) {
      process.exit(1);
    }
  }
}

const tester = new UnitTester();

// Test FileProcessor
tester.test('FileProcessor: Extract front matter', async () => {
  const fileProcessor = new FileProcessor();
  const content = `---
title: Test Page
displayed_sidebar: docsEnglish
---

# Test Content

This is a test.`;

  const { frontMatter, body } = fileProcessor.extractFrontMatter(content);
  
  assert.strictEqual(frontMatter.title, 'Test Page');
  assert.strictEqual(frontMatter.displayed_sidebar, 'docsEnglish');
  assert(body.includes('# Test Content'));
});

tester.test('FileProcessor: Update front matter', async () => {
  const fileProcessor = new FileProcessor();
  const frontMatter = {
    title: 'Test Page',
    displayed_sidebar: 'docsEnglish'
  };

  const updated = fileProcessor.updateFrontMatter(frontMatter, {
    'docsEnglish': 'docsJapanese'
  });

  assert.strictEqual(updated.displayed_sidebar, 'docsJapanese');
  assert.strictEqual(updated.title, 'Test Page');
});

tester.test('FileProcessor: Add translation banner', async () => {
  const fileProcessor = new FileProcessor();
  const body = `# Test Title

Some content here.`;

  const withBanner = fileProcessor.addTranslationBanner(body, '/src/components/_translation-ja-jp.mdx');
  
  assert(withBanner.includes('import TranslationBanner'));
  assert(withBanner.includes('<TranslationBanner />'));
});

tester.test('FileProcessor: Reassemble file', async () => {
  const fileProcessor = new FileProcessor();
  const frontMatter = { title: 'Test', sidebar: 'docs' };
  const body = '# Content';

  const assembled = fileProcessor.reassembleFile(frontMatter, body);
  
  assert(assembled.includes('---'));
  assert(assembled.includes('title: Test'));
  assert(assembled.includes('# Content'));
});

// Test AnchorLinkFixer
tester.test('AnchorLinkFixer: Fix anchor links', async () => {
  const anchorFixer = new AnchorLinkFixer();
  const originalBody = `# Getting Started

[Link to features](#features)

## Features

Some content.`;

  const translatedBody = `# はじめに

[Link to features](#features)

## 機能

Some content.`;

  const fixed = anchorFixer.fixAnchorLinks(translatedBody, originalBody);
  
  assert(fixed.includes('#機能'));
});

// Test File Detection Logic
tester.test('File Detection: Markdown file filtering', async () => {
  const mockFiles = [
    { filename: 'docs/guide.md', status: 'modified' },
    { filename: 'docs/ja-jp/guide.md', status: 'modified' },
    { filename: 'README.md', status: 'added' },
    { filename: 'package.json', status: 'modified' },
    { filename: 'docs/api.mdx', status: 'added' },
    { filename: 'deleted.md', status: 'removed' }
  ];

  const validExtensions = ['.md', '.mdx'];
  const filtered = mockFiles.filter(file => {
    const hasValidExtension = validExtensions.some(ext => file.filename.endsWith(ext));
    const isInJapaneseDir = file.filename.includes('docs/ja-jp');
    const isAddedOrModified = ['added', 'modified'].includes(file.status);
    
    return hasValidExtension && !isInJapaneseDir && isAddedOrModified;
  });

  assert.strictEqual(filtered.length, 3); // guide.md, README.md, api.mdx
  assert(filtered.some(f => f.filename === 'docs/guide.md'));
  assert(filtered.some(f => f.filename === 'README.md'));
  assert(filtered.some(f => f.filename === 'docs/api.mdx'));
});

// Test Japanese File Path Generation
tester.test('Japanese Path Generation', async () => {
  function generateJapaneseFilePath(originalPath) {
    const pathParts = originalPath.split('/');
    const docsIndex = pathParts.findIndex(part => part === 'docs');
    if (docsIndex !== -1) {
      pathParts.splice(docsIndex + 1, 0, 'ja-jp');
    } else {
      pathParts.unshift('docs', 'ja-jp');
    }
    return pathParts.join('/');
  }

  assert.strictEqual(
    generateJapaneseFilePath('docs/guides/getting-started.md'),
    'docs/ja-jp/guides/getting-started.md'
  );
  
  assert.strictEqual(
    generateJapaneseFilePath('README.md'),
    'docs/ja-jp/README.md'
  );
});

// Run all tests
tester.run().catch(error => {
  console.error('Test runner failed:', error);
  process.exit(1);
});
