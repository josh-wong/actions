#!/usr/bin/env node

const core = require('@actions/core');
const github = require('@actions/github');
const fs = require('fs').promises;
const path = require('path');
const { execSync } = require('child_process');

const ClaudeCodeTranslator = require('./claude-code-translator');
const FileProcessor = require('./file-processor');
const PRMetadataExtractor = require('./pr-metadata-extractor');
const AnchorLinkFixer = require('./anchor-link-fixer');

class MarkdownTranslationWorkflow {
  constructor() {
    this.octokit = github.getOctokit(process.env.GITHUB_TOKEN);
    this.context = github.context;
    this.translator = new ClaudeCodeTranslator();
    this.fileProcessor = new FileProcessor();
    this.prMetadataExtractor = new PRMetadataExtractor(this.octokit);
    this.anchorLinkFixer = new AnchorLinkFixer();
    
    // Configuration from environment.
    this.config = {
      prNumber: parseInt(process.env.PR_NUMBER),
      prTitle: process.env.PR_TITLE,
      prBody: process.env.PR_BODY,
      prAuthor: process.env.PR_AUTHOR,
      prHeadRef: process.env.PR_HEAD_REF,
      repositoryOwner: process.env.REPOSITORY_OWNER,
      repositoryName: process.env.REPOSITORY_NAME,
      targetLanguage: 'ja-jp',
      sidebarMapping: {
        'docsEnglish': 'docsJapanese'
      },
      translationBannerPath: '/src/components/_translation-ja-jp.mdx',
      fileExtensions: ['.md', '.mdx']
    };
  }

  async run() {
    try {
      console.log('🚀 Starting auto-translate Markdown workflow...');
      
      // Step 1: Detect and filter Markdown files.
      const changedFiles = await this.detectMarkdownFiles();
      console.log(`📁 Found ${changedFiles.length} Markdown files to translate`);
      
      if (changedFiles.length === 0) {
        console.log('✅ No files to translate. Exiting...');
        return;
      }

      // Step 2: Extract PR metadata.
      const prMetadata = await this.prMetadataExtractor.extractMetadata(this.config.prNumber);
      console.log('📋 Extracted PR metadata');

      // Step 3: Create translation branch.
      const translationBranch = await this.createTranslationBranch();
      console.log(`🌿 Created translation branch: ${translationBranch}`);

      // Step 4: Process and translate files.
      const translatedFiles = await this.translateFiles(changedFiles);
      console.log(`📝 Translated ${translatedFiles.length} files`);

      // Step 5: Create pull request.
      await this.createTranslationPR(translationBranch, translatedFiles, prMetadata);
      console.log('🎉 Translation workflow completed successfully!');

    } catch (error) {
      console.error('❌ Translation workflow failed:', error);
      core.setFailed(error.message);
      throw error;
    }
  }

  async detectMarkdownFiles() {
    console.log('🔍 Detecting changed Markdown files...');
    
    // Get list of changed files from the merged PR.
    const { data: prFiles } = await this.octokit.rest.pulls.listFiles({
      owner: this.config.repositoryOwner,
      repo: this.config.repositoryName,
      pull_number: this.config.prNumber
    });

    const markdownFiles = prFiles.filter(file => {
      // Filter for .md and .mdx files.
      const hasValidExtension = this.config.fileExtensions.some(ext => 
        file.filename.endsWith(ext)
      );
      
      // Exclude files in docs/ja-jp directories.
      const isInJapaneseDir = file.filename.includes('docs/ja-jp');
      
      // Only process added or modified files (not deleted).
      const isAddedOrModified = ['added', 'modified'].includes(file.status);
      
      return hasValidExtension && !isInJapaneseDir && isAddedOrModified;
    });

    console.log(`📊 Filtered ${markdownFiles.length} files from ${prFiles.length} total changed files`);
    return markdownFiles.map(file => file.filename);
  }

  async createTranslationBranch() {
    const branchName = `${this.config.prHeadRef}-ja-jp`;
    console.log(`🌿 Creating translation branch: ${branchName}`);

    try {
      // Get the latest commit SHA from main/master.
      const { data: mainBranch } = await this.octokit.rest.repos.getBranch({
        owner: this.config.repositoryOwner,
        repo: this.config.repositoryName,
        branch: 'main'
      });

      // Create new branch.
      await this.octokit.rest.git.createRef({
        owner: this.config.repositoryOwner,
        repo: this.config.repositoryName,
        ref: `refs/heads/${branchName}`,
        sha: mainBranch.commit.sha
      });

      // Checkout the new branch locally.
      execSync(`git checkout -b ${branchName}`, { stdio: 'inherit' });
      
      return branchName;
    } catch (error) {
      if (error.status === 422) {
        console.log(`⚠️ Branch ${branchName} already exists, checking it out...`);
        execSync(`git checkout ${branchName}`, { stdio: 'inherit' });
        return branchName;
      }
      throw error;
    }
  }

  async translateFiles(filePaths) {
    console.log(`📝 Starting translation of ${filePaths.length} files...`);
    const translatedFiles = [];

    for (const filePath of filePaths) {
      try {
        console.log(`🔄 Processing: ${filePath}`);
        
        // Read the original file.
        const content = await fs.readFile(filePath, 'utf8');
        
        // Generate Japanese file path.
        const japaneseFilePath = this.generateJapaneseFilePath(filePath);
        
        // Process the file (extract front matter, translate, modify).
        const processedContent = await this.processFile(content, filePath);
        
        // Ensure directory exists.
        await fs.mkdir(path.dirname(japaneseFilePath), { recursive: true });
        
        // Write the translated file.
        await fs.writeFile(japaneseFilePath, processedContent, 'utf8');
        
        // Stage the file for commit.
        execSync(`git add "${japaneseFilePath}"`, { stdio: 'inherit' });
        
        translatedFiles.push({
          originalPath: filePath,
          translatedPath: japaneseFilePath
        });
        
        console.log(`✅ Translated: ${filePath} → ${japaneseFilePath}`);
        
      } catch (error) {
        console.error(`❌ Failed to translate ${filePath}:`, error);
        // Continue with other files instead of failing completely.
      }
    }

    // Commit all translated files.
    if (translatedFiles.length > 0) {
      const commitMessage = `feat: add Japanese translations\n\nAuto-translated from PR #${this.config.prNumber}: ${this.config.prTitle}`;
      execSync(`git commit -m "${commitMessage}"`, { stdio: 'inherit' });
      execSync(`git push origin HEAD`, { stdio: 'inherit' });
    }

    return translatedFiles;
  }

  generateJapaneseFilePath(originalPath) {
    // Convert path like "docs/guides/getting-started.md" to "docs/ja-jp/guides/getting-started.md".
    const pathParts = originalPath.split('/');
    
    // Find the docs directory and insert ja-jp after it.
    const docsIndex = pathParts.findIndex(part => part === 'docs');
    if (docsIndex !== -1) {
      pathParts.splice(docsIndex + 1, 0, 'ja-jp');
    } else {
      // If no docs directory, create one.
      pathParts.unshift('docs', 'ja-jp');
    }
    
    return pathParts.join('/');
  }

  async processFile(content, filePath) {
    console.log(`🔧 Processing file: ${filePath}`);
    
    // Step 1: Extract and parse front matter.
    const { frontMatter, body } = this.fileProcessor.extractFrontMatter(content);
    
    // Step 2: Translate the main content.
    const translatedBody = await this.translator.translateMarkdown(body, filePath);
    
    // Step 3: Update front matter.
    const updatedFrontMatter = this.fileProcessor.updateFrontMatter(
      frontMatter, 
      this.config.sidebarMapping
    );
    
    // Step 4: Add translation banner.
    const bodyWithBanner = this.fileProcessor.addTranslationBanner(
      translatedBody, 
      this.config.translationBannerPath
    );
    
    // Step 5: Fix anchor links.
    const finalBody = this.anchorLinkFixer.fixAnchorLinks(bodyWithBanner, body);
    
    // Step 6: Reassemble the file.
    return this.fileProcessor.reassembleFile(updatedFrontMatter, finalBody);
  }

  async createTranslationPR(branchName, translatedFiles, prMetadata) {
    console.log('📤 Creating translation pull request...');
    
    const prTitle = `🌐 Japanese translations for PR #${this.config.prNumber}`;
    const prBody = this.generatePRBody(translatedFiles, prMetadata);
    
    try {
      // Create the pull request.
      const { data: newPR } = await this.octokit.rest.pulls.create({
        owner: this.config.repositoryOwner,
        repo: this.config.repositoryName,
        title: prTitle,
        body: prBody,
        head: branchName,
        base: 'main'
      });

      console.log(`📋 Created PR #${newPR.number}: ${newPR.html_url}`);

      // Apply metadata (labels, reviewers, assignees, projects).
      await this.applyPRMetadata(newPR.number, prMetadata);
      
      return newPR;
    } catch (error) {
      console.error('❌ Failed to create translation PR:', error);
      throw error;
    }
  }

  generatePRBody(translatedFiles, prMetadata) {
    const fileList = translatedFiles
      .map(file => `- \`${file.translatedPath}\` (from \`${file.originalPath}\`)`)
      .join('\n');

    return `## 🌐 Japanese translation

This PR contains automatic Japanese translations generated from the content merged in PR #${this.config.prNumber}.

### 📁 Translated files

${fileList}

### 🔗 Source

- **Original PR:** #${this.config.prNumber} - ${this.config.prTitle}
- **Author:** @${this.config.prAuthor}
- **Branch:** \`${this.config.prHeadRef}\`

### 🤖 Translation details

- **Target language:** Japanese (ja-jp)
- **Translation method:** Claude Code (Anthropic)
- **Translation banner:** Added to all translated files
- **Sidebar:** Updated from "docsEnglish" to "docsJapanese"
- **Anchor links:** Updated to match Japanese headings

### ✅ Review checklist

- [ ] Translation accuracy and natural Japanese phrasing
- [ ] Technical terminology consistency
- [ ] Link functionality (especially anchor links)
- [ ] Front matter configuration
- [ ] Translation banner placement

---
*This translation was automatically generated. Please review for accuracy and naturalness.*`;
  }

  async applyPRMetadata(prNumber, metadata) {
    console.log('🏷️ Applying PR metadata...');
    
    try {
      // Add "documentation" label.
      const labels = [...(metadata.labels || []), 'documentation'];
      await this.octokit.rest.issues.addLabels({
        owner: this.config.repositoryOwner,
        repo: this.config.repositoryName,
        issue_number: prNumber,
        labels: labels
      });

      // Add reviewers (if any from original PR).
      if (metadata.reviewers && metadata.reviewers.length > 0) {
        await this.octokit.rest.pulls.requestReviewers({
          owner: this.config.repositoryOwner,
          repo: this.config.repositoryName,
          pull_number: prNumber,
          reviewers: metadata.reviewers
        });
      }

      // Add assignee (original PR author).
      if (this.config.prAuthor) {
        await this.octokit.rest.issues.addAssignees({
          owner: this.config.repositoryOwner,
          repo: this.config.repositoryName,
          issue_number: prNumber,
          assignees: [this.config.prAuthor]
        });
      }

      console.log('✅ Applied PR metadata successfully');
    } catch (error) {
      console.error('⚠️ Failed to apply some PR metadata:', error);
      // Don't fail the entire workflow for metadata issues.
    }
  }
}

// Run the workflow.
if (require.main === module) {
  const workflow = new MarkdownTranslationWorkflow();
  workflow.run().catch(error => {
    console.error('💥 Workflow execution failed:', error);
    process.exit(1);
  });
}

module.exports = MarkdownTranslationWorkflow;
