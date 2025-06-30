class AnchorLinkFixer {
  constructor() {
    this.anchorLinkRegex = /\[([^\]]*)\]\(#([^)]+)\)/g;
    this.headingRegex = /^(#{1,6})\s+(.+)$/;
  }

  fixAnchorLinks(translatedContent, originalContent) {
    console.log('🔗 Fixing anchor links in translated content...');
    
    if (!translatedContent || !originalContent) {
      console.warn('⚠️ Missing content for anchor link fixing');
      return translatedContent;
    }

    try {
      // Extract headings from both original and translated content
      const originalHeadings = this.extractHeadings(originalContent);
      const translatedHeadings = this.extractHeadings(translatedContent);
      
      // Create mapping between original and translated anchors
      const anchorMap = this.createAnchorMapping(originalHeadings, translatedHeadings);
      
      console.log(`📊 Found ${Object.keys(anchorMap).length} anchor mappings`);
      
      // Replace anchor links in translated content
      const fixedContent = this.replaceAnchorLinks(translatedContent, anchorMap);
      
      console.log('✅ Anchor links fixed successfully');
      return fixedContent;
      
    } catch (error) {
      console.error('❌ Failed to fix anchor links:', error.message);
      return translatedContent; // Return original if fixing fails
    }
  }

  extractHeadings(content) {
    const headings = [];
    const lines = content.split('\n');
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      const match = line.match(this.headingRegex);
      
      if (match) {
        const [, hashes, text] = match;
        const level = hashes.length;
        const anchor = this.generateAnchor(text);
        
        headings.push({
          level,
          text: text.trim(),
          anchor,
          lineNumber: i
        });
      }
    }
    
    return headings;
  }

  generateAnchor(text) {
    // Generate GitHub-style anchor links
    return text
      .toLowerCase()
      .trim()
      // Remove markdown formatting
      .replace(/\*\*([^*]+)\*\*/g, '$1') // Bold
      .replace(/\*([^*]+)\*/g, '$1')     // Italic
      .replace(/`([^`]+)`/g, '$1')       // Code
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // Links
      // Replace special characters and spaces
      .replace(/[^\w\s\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF-]/g, '') // Keep word chars, spaces, and Japanese
      .replace(/\s+/g, '-')              // Replace spaces with hyphens
      .replace(/-+/g, '-')               // Replace multiple hyphens with single
      .replace(/^-|-$/g, '');            // Remove leading/trailing hyphens
  }

  createAnchorMapping(originalHeadings, translatedHeadings) {
    const anchorMap = {};
    
    // Try to match headings by level and position
    for (let i = 0; i < originalHeadings.length && i < translatedHeadings.length; i++) {
      const original = originalHeadings[i];
      const translated = translatedHeadings[i];
      
      // Map if the levels match (assuming structure is preserved)
      if (original.level === translated.level) {
        anchorMap[original.anchor] = translated.anchor;
      }
    }
    
    // Fallback: try to match by similar content structure
    this.addFallbackMappings(originalHeadings, translatedHeadings, anchorMap);
    
    return anchorMap;
  }

  addFallbackMappings(originalHeadings, translatedHeadings, anchorMap) {
    // For headings not yet mapped, try to find matches by level
    const unmappedOriginal = originalHeadings.filter(h => !anchorMap[h.anchor]);
    const unmappedTranslated = translatedHeadings.filter(h => 
      !Object.values(anchorMap).includes(h.anchor)
    );
    
    // Group by level for better matching
    const originalByLevel = this.groupHeadingsByLevel(unmappedOriginal);
    const translatedByLevel = this.groupHeadingsByLevel(unmappedTranslated);
    
    // Match within each level
    for (const level of Object.keys(originalByLevel)) {
      const originals = originalByLevel[level] || [];
      const translated = translatedByLevel[level] || [];
      
      const maxLength = Math.min(originals.length, translated.length);
      for (let i = 0; i < maxLength; i++) {
        anchorMap[originals[i].anchor] = translated[i].anchor;
      }
    }
  }

  groupHeadingsByLevel(headings) {
    return headings.reduce((groups, heading) => {
      const level = heading.level;
      if (!groups[level]) {
        groups[level] = [];
      }
      groups[level].push(heading);
      return groups;
    }, {});
  }

  replaceAnchorLinks(content, anchorMap) {
    return content.replace(this.anchorLinkRegex, (match, linkText, anchor) => {
      const mappedAnchor = anchorMap[anchor];
      
      if (mappedAnchor) {
        console.log(`🔄 Mapped anchor: #${anchor} → #${mappedAnchor}`);
        return `[${linkText}](#${mappedAnchor})`;
      } else {
        console.warn(`⚠️ No mapping found for anchor: #${anchor}`);
        return match; // Keep original if no mapping found
      }
    });
  }

  // Helper method to validate anchor links
  validateAnchorLinks(content) {
    const issues = [];
    const headings = this.extractHeadings(content);
    const headingAnchors = new Set(headings.map(h => h.anchor));
    
    // Find all anchor links
    const anchorLinks = [];
    let match;
    while ((match = this.anchorLinkRegex.exec(content)) !== null) {
      anchorLinks.push({
        text: match[1],
        anchor: match[2],
        fullMatch: match[0]
      });
    }
    
    // Check if each anchor link has a corresponding heading
    for (const link of anchorLinks) {
      if (!headingAnchors.has(link.anchor)) {
        issues.push(`Broken anchor link: ${link.fullMatch}`);
      }
    }
    
    return issues;
  }

  // Helper method to get anchor link statistics
  getAnchorLinkStats(content) {
    const headings = this.extractHeadings(content);
    const anchorLinks = [];
    
    let match;
    while ((match = this.anchorLinkRegex.exec(content)) !== null) {
      anchorLinks.push(match[2]);
    }
    
    return {
      totalHeadings: headings.length,
      totalAnchorLinks: anchorLinks.length,
      uniqueAnchors: new Set(anchorLinks).size,
      headingLevels: headings.reduce((levels, h) => {
        levels[h.level] = (levels[h.level] || 0) + 1;
        return levels;
      }, {})
    };
  }

  // Helper method to preview anchor mapping
  previewAnchorMapping(originalContent, translatedContent) {
    const originalHeadings = this.extractHeadings(originalContent);
    const translatedHeadings = this.extractHeadings(translatedContent);
    const anchorMap = this.createAnchorMapping(originalHeadings, translatedHeadings);
    
    console.log('\n📋 Anchor Mapping Preview:');
    for (const [original, translated] of Object.entries(anchorMap)) {
      console.log(`  ${original} → ${translated}`);
    }
    
    return anchorMap;
  }
}

module.exports = AnchorLinkFixer;
