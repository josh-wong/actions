# Auto-Translate Markdown Claude Tests

This document describes the comprehensive test suite for the auto-translate markdown workflow that uses Claude Code for Japanese translation.

## Test Files Overview

The test suite consists of 5 main test files located in `auto-translate-markdown-claude/tests/`:

### 1. `integration-test.js`
**Purpose**: Local integration testing that simulates the complete workflow

**Key Components**:
- **LocalTester Class**: Main test orchestrator
- **Environment Setup**: Creates temporary test environment with mock GitHub variables
- **Test File Creation**: Generates sample Markdown files with front matter, headings, and content
- **File Processing Tests**: Tests front matter extraction, sidebar updates, and translation banner addition
- **Mock Claude Code Integration**: Simulates translation with simple text replacements
- **Git Operations Testing**: Dry-run testing of Git commands that would be used

**Test Coverage**:
- Front matter extraction and modification
- Translation banner insertion
- File reassembly
- Mock translation functionality
- Git workflow simulation

### 2. `local-test.js`
**Purpose**: Workflow component testing focusing on individual parts of the translation pipeline

**Key Components**:
- **LocalWorkflowTester Class**: Tests specific workflow components
- **File Detection Logic**: Tests filtering of eligible Markdown files
- **File Processing Pipeline**: Tests the complete file transformation process
- **Translation Logic Testing**: Mock translation with Japanese character mapping
- **PR Body Generation**: Tests automatic PR description creation
- **Path Generation**: Tests Japanese file path creation logic

**Test Scenarios**:
- Filters files by extension (.md, .mdx) and status (added/modified)
- Excludes existing Japanese files in `docs/ja-jp`
- Generates proper Japanese file paths
- Creates comprehensive PR descriptions with file lists and metadata

### 3. `unit-tests.js`
**Purpose**: Individual function and module testing

**Key Components**:
- **UnitTester Class**: Custom test runner with assertion support
- **FileProcessor Tests**: Tests individual file processing methods
- **AnchorLinkFixer Tests**: Tests anchor link translation and fixing
- **File Detection Tests**: Tests Markdown file filtering logic
- **Path Generation Tests**: Tests Japanese path generation

**Tested Functions**:
- `extractFrontMatter()`: YAML front matter parsing
- `updateFrontMatter()`: Sidebar mapping updates
- `addTranslationBanner()`: Banner component insertion
- `reassembleFile()`: File reconstruction from parts
- `fixAnchorLinks()`: Anchor link translation alignment

### 4. `run-tests.js`
**Purpose**: Test suite orchestrator and runner

**Functionality**:
- Executes all test types in sequence
- Provides unified test reporting
- Handles test failures and exit codes
- Supports individual test type execution

**Test Commands**:
- `npm run test:unit`: Unit tests only
- `npm run test:integration`: Integration tests only  
- `npm run test:local`: Local workflow tests only

### 5. `setup-dev-env.js`
**Purpose**: Development environment setup and validation

**Key Features**:
- **Environment Validation**: Checks Node.js, npm, Git, and Claude Code CLI
- **Configuration File Creation**: Generates `.env.example` and test configuration
- **API Key Validation**: Checks for required environment variables
- **Quick Start Guide**: Provides setup and usage instructions

**Environment Requirements**:
- Node.js 18+
- Git
- Claude Code CLI (`@anthropic-ai/claude-code`)
- `ANTHROPIC_API_KEY`
- `GITHUB_TOKEN`

## Test Data and Scenarios

### Sample Content
The tests use realistic Markdown content with:
- YAML front matter with `displayed_sidebar` configuration
- Multiple heading levels for anchor link testing
- Code blocks and inline code
- Internal and external links
- Lists and formatted content

### Mock Translation Mappings
Common English-to-Japanese translations used in tests:
- "Getting Started" → "はじめに"
- "Prerequisites" → "前提条件" 
- "Installation" → "インストール"
- "Features" → "機能"
- "Next Steps" → "次のステップ"

### File Processing Pipeline
1. **Detection**: Filter eligible Markdown files from PR
2. **Extraction**: Parse front matter and body content
3. **Translation**: Process content through Claude Code
4. **Transformation**: Update sidebars, add banners, fix anchor links
5. **Output**: Generate Japanese files in `docs/ja-jp/` structure

## Running the Tests

### Prerequisites
```bash
# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your API keys
```

### Test Execution
```bash
# Run all tests
npm test

# Run specific test types
npm run test:unit         # Unit tests only
npm run test:integration  # Integration tests  
npm run test:local       # Local workflow tests

# Set up development environment
npm run setup:dev
```

### Expected Output
- ✅ All tests should pass in a properly configured environment
- 📊 Test summary shows passed/failed counts
- 🎉 Success message confirms workflow functionality

## Test Configuration

### Mock Data Structure
```javascript
{
  prNumber: 123,
  prTitle: 'Add new documentation',
  prAuthor: 'testuser',
  prHeadRef: 'feature/docs',
  repositoryOwner: 'testowner',
  repositoryName: 'testrepo'
}
```

### File Path Mapping
- `docs/guides/getting-started.md` → `docs/ja-jp/guides/getting-started.md`
- `README.md` → `docs/ja-jp/README.md`
- `docs/api/reference.mdx` → `docs/ja-jp/api/reference.mdx`

## Integration Points

The test suite validates integration with:
- **GitHub API**: PR file retrieval and creation
- **Claude Code CLI**: Markdown translation
- **Git Operations**: Branch and commit management
- **File System**: File creation and organization
- **YAML Processing**: Front matter handling

This test suite ensures the auto-translate workflow functions correctly across all components and provides confidence for production deployment.