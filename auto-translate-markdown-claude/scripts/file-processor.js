const yaml = require('js-yaml');

class FileProcessor {
  constructor() {
    this.frontMatterRegex = /^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/;
  }

  extractFrontMatter(content) {
    console.log('📋 Extracting front matter...');
    
    const match = content.match(this.frontMatterRegex);
    
    if (match) {
      try {
        const frontMatterYaml = match[1];
        const body = match[2];
        const frontMatter = yaml.load(frontMatterYaml);
        
        console.log('✅ Front matter extracted successfully');
        return { frontMatter, body, hasFrontMatter: true };
      } catch (error) {
        console.warn('⚠️ Failed to parse front matter YAML:', error.message);
        return { frontMatter: {}, body: content, hasFrontMatter: false };
      }
    }
    
    console.log('ℹ️ No front matter found');
    return { frontMatter: {}, body: content, hasFrontMatter: false };
  }

  updateFrontMatter(frontMatter, sidebarMapping) {
    console.log('🔧 Updating front matter...');
    
    if (!frontMatter || typeof frontMatter !== 'object') {
      console.log('ℹ️ No front matter to update');
      return frontMatter;
    }

    const updated = { ...frontMatter };
    
    // Update displayed_sidebar mapping
    if (updated.displayed_sidebar && sidebarMapping[updated.displayed_sidebar]) {
      const oldValue = updated.displayed_sidebar;
      updated.displayed_sidebar = sidebarMapping[oldValue];
      console.log(`📝 Updated displayed_sidebar: "${oldValue}" → "${updated.displayed_sidebar}"`);
    }
    
    // Add translation metadata
    updated.translated = true;
    updated.translation_source = 'claude-code';
    updated.translation_date = new Date().toISOString().split('T')[0];
    
    console.log('✅ Front matter updated');
    return updated;
  }

  addTranslationBanner(content, bannerPath) {
    console.log('🏷️ Adding translation banner...');
    
    if (!content || typeof content !== 'string') {
      console.warn('⚠️ Invalid content for banner insertion');
      return content;
    }

    const bannerImport = `import TranslationBanner from '${bannerPath}';`;
    const bannerComponent = '\n<TranslationBanner />\n';
    
    // Find the first heading (title) to insert banner after it
    const lines = content.split('\n');
    let titleLineIndex = -1;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line.startsWith('# ')) {
        titleLineIndex = i;
        break;
      }
    }
    
    if (titleLineIndex === -1) {
      console.warn('⚠️ No title heading found, adding banner at the beginning');
      return `${bannerImport}\n\n${bannerComponent}\n${content}`;
    }
    
    // Insert import at the beginning and banner after title
    const beforeTitle = lines.slice(0, titleLineIndex + 1);
    const afterTitle = lines.slice(titleLineIndex + 1);
    
    const result = [
      bannerImport,
      '',
      ...beforeTitle,
      bannerComponent,
      ...afterTitle
    ].join('\n');
    
    console.log('✅ Translation banner added');
    return result;
  }

  reassembleFile(frontMatter, body) {
    console.log('🔗 Reassembling file...');
    
    if (!frontMatter || Object.keys(frontMatter).length === 0) {
      console.log('ℹ️ No front matter to include');
      return body;
    }
    
    try {
      const frontMatterYaml = yaml.dump(frontMatter, {
        lineWidth: -1, // Don't wrap lines
        noRefs: true,   // Don't use references
        sortKeys: false // Preserve key order
      });
      
      const result = `---\n${frontMatterYaml}---\n${body}`;
      console.log('✅ File reassembled successfully');
      return result;
    } catch (error) {
      console.error('❌ Failed to serialize front matter:', error.message);
      return body;
    }
  }

  // Helper method to validate markdown structure
  validateMarkdown(content) {
    const issues = [];
    
    // Check for basic markdown structure
    if (!content || typeof content !== 'string') {
      issues.push('Content is not a valid string');
      return issues;
    }
    
    // Check for unmatched code blocks
    const codeBlockMatches = content.match(/```/g);
    if (codeBlockMatches && codeBlockMatches.length % 2 !== 0) {
      issues.push('Unmatched code block delimiters');
    }
    
    // Check for malformed links
    const linkRegex = /\[([^\]]*)\]\(([^)]*)\)/g;
    let match;
    while ((match = linkRegex.exec(content)) !== null) {
      const [, text, url] = match;
      if (!text.trim()) {
        issues.push('Empty link text found');
      }
      if (!url.trim()) {
        issues.push('Empty link URL found');
      }
    }
    
    return issues;
  }

  // Helper method to extract headings
  extractHeadings(content) {
    const headings = [];
    const lines = content.split('\n');
    
    for (const line of lines) {
      const trimmed = line.trim();
      const match = trimmed.match(/^(#{1,6})\s+(.+)$/);
      if (match) {
        const [, hashes, text] = match;
        headings.push({
          level: hashes.length,
          text: text,
          anchor: this.generateAnchor(text)
        });
      }
    }
    
    return headings;
  }

  // Helper method to generate anchor links from heading text
  generateAnchor(text) {
    return text
      .toLowerCase()
      .replace(/[^\w\s-]/g, '') // Remove special characters
      .replace(/\s+/g, '-')     // Replace spaces with hyphens
      .trim();
  }

  // Helper method to count words (useful for translation metrics)
  countWords(content) {
    if (!content || typeof content !== 'string') {
      return 0;
    }
    
    // Remove code blocks first
    const withoutCodeBlocks = content.replace(/```[\s\S]*?```/g, '');
    
    // Remove inline code
    const withoutInlineCode = withoutCodeBlocks.replace(/`[^`]*`/g, '');
    
    // Count words
    const words = withoutInlineCode
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 0);
    
    return words.length;
  }
}

module.exports = FileProcessor;
