#!/usr/bin/env node

const fs = require('fs').promises;
const path = require('path');
const { execSync } = require('child_process');

console.log('🔧 Setting up development environment...\n');

async function setupDevEnv() {
  console.log('📋 Development Environment Setup Checklist:\n');

  // Check Node.js version
  try {
    const nodeVersion = execSync('node --version', { encoding: 'utf8' }).trim();
    console.log(`✅ Node.js: ${nodeVersion}`);
    
    const majorVersion = parseInt(nodeVersion.substring(1).split('.')[0]);
    if (majorVersion < 18) {
      console.log('⚠️  Warning: Node.js 18+ recommended');
    }
  } catch (error) {
    console.log('❌ Node.js not found');
  }

  // Check npm
  try {
    const npmVersion = execSync('npm --version', { encoding: 'utf8' }).trim();
    console.log(`✅ npm: ${npmVersion}`);
  } catch (error) {
    console.log('❌ npm not found');
  }

  // Check Git
  try {
    const gitVersion = execSync('git --version', { encoding: 'utf8' }).trim();
    console.log(`✅ Git: ${gitVersion}`);
  } catch (error) {
    console.log('❌ Git not found');
  }

  // Check Claude Code CLI
  try {
    const claudeVersion = execSync('claude-code --version', { encoding: 'utf8' }).trim();
    console.log(`✅ Claude Code CLI: ${claudeVersion}`);
  } catch (error) {
    console.log('❌ Claude Code CLI not found');
    console.log('   Install with: npm install -g @anthropic-ai/claude-code');
  }

  console.log('\n🔐 Environment Variables Check:\n');

  const requiredEnvVars = [
    'ANTHROPIC_API_KEY',
    'GITHUB_TOKEN'
  ];

  for (const envVar of requiredEnvVars) {
    if (process.env[envVar]) {
      console.log(`✅ ${envVar}: Set (${process.env[envVar].substring(0, 8)}...)`);
    } else {
      console.log(`❌ ${envVar}: Not set`);
    }
  }

  console.log('\n📝 Creating example configuration files...\n');

  // Create .env.example
  const envExample = `# Copy this file to .env and fill in your values

# Required: Anthropic API key for Claude Code
ANTHROPIC_API_KEY=sk-ant-api03-...

# Required: GitHub token with repo permissions
GITHUB_TOKEN=ghp_...

# For testing: Mock PR data
PR_NUMBER=123
PR_TITLE="Test PR Title"
PR_BODY="Test PR body content"
PR_AUTHOR="testuser"
PR_HEAD_REF="feature/test-branch"
REPOSITORY_OWNER="your-username"
REPOSITORY_NAME="your-repo"
`;

  await fs.writeFile('.env.example', envExample);
  console.log('✅ Created .env.example');

  // Create test configuration
  const testConfig = `{
  "testRepo": {
    "owner": "your-username",
    "name": "test-repo",
    "branch": "main"
  },
  "sampleFiles": [
    {
      "path": "docs/getting-started.md",
      "content": "Sample markdown content for testing"
    }
  ],
  "mockTranslations": {
    "# Getting Started": "# はじめに",
    "Welcome": "ようこそ",
    "Installation": "インストール"
  }
}`;

  await fs.writeFile('test/test-config.json', testConfig);
  console.log('✅ Created test/test-config.json');

  console.log('\n🚀 Quick Start Commands:\n');
  console.log('Install dependencies:');
  console.log('  npm install\n');
  
  console.log('Run tests:');
  console.log('  npm test              # Run all tests');
  console.log('  npm run test:unit     # Unit tests only');
  console.log('  npm run test:local    # Local integration test\n');
  
  console.log('Development workflow:');
  console.log('  1. Copy .env.example to .env and fill in your API keys');
  console.log('  2. Run npm install to install dependencies');
  console.log('  3. Run npm run test:local to test locally');
  console.log('  4. Test in a real repository by triggering the workflow\n');

  console.log('📚 Documentation:');
  console.log('  - README.md: Complete setup and usage guide');
  console.log('  - sample-usage.md: Example configurations');
  console.log('  - test/: Test files and examples\n');

  console.log('🎯 Ready to test! Run `npm test` to verify everything works.');
}

setupDevEnv().catch(error => {
  console.error('Setup failed:', error);
  process.exit(1);
});
