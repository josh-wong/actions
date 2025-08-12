const { execSync } = require('child_process');
const fs = require('fs').promises;
const path = require('path');

class ClaudeCodeTranslator {
  constructor() {
    this.maxRetries = 3;
    this.retryDelay = 1000; // 1 second
    this.authInitialized = false;
  }

  async ensureClaudeAuth() {
    if (this.authInitialized) {
      return;
    }

    try {
      // Check if Claude CLI is available and authenticated
      execSync('claude --version', { stdio: 'pipe' });
      
      // If we have an API key, ensure it's set
      if (process.env.ANTHROPIC_API_KEY) {
        // Claude CLI can use ANTHROPIC_API_KEY environment variable
        console.log('✅ Claude CLI authenticated via environment variable');
        this.authInitialized = true;
      } else {
        throw new Error('ANTHROPIC_API_KEY environment variable not set');
      }
    } catch (error) {
      throw new Error(`Claude CLI not available or not authenticated: ${error.message}`);
    }
  }

  async translateMarkdown(content, filePath) {
    console.log(`🔤 Translating content using Claude Code...`);
    
    const prompt = this.buildTranslationPrompt(content, filePath);
    
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        console.log(`🔄 Translation attempt ${attempt}/${this.maxRetries}`);
        
        const result = await this.callClaudeCode(prompt);
        
        if (result && result.translatedContent) {
          console.log('✅ Translation successful');
          return result.translatedContent;
        }
        
        throw new Error('No translated content returned from Claude Code');
        
      } catch (error) {
        console.error(`❌ Translation attempt ${attempt} failed:`, error.message);
        
        if (attempt === this.maxRetries) {
          throw new Error(`Translation failed after ${this.maxRetries} attempts: ${error.message}`);
        }
        
        // Wait before retrying
        await this.sleep(this.retryDelay * attempt);
      }
    }
  }

  buildTranslationPrompt(content, filePath) {
    return `Translate this Markdown content from English to Japanese:

REQUIREMENTS:
- Preserve ALL Markdown formatting exactly
- Do NOT translate code blocks, URLs, file paths, or technical commands  
- Keep front matter YAML unchanged
- Use natural, professional Japanese
- Preserve document structure exactly

Content:
${content}

Return only the translated markdown:`;
  }

  async callClaudeCode(prompt) {
    try {
      // Ensure Claude is authenticated
      await this.ensureClaudeAuth();
      
      // Create a temporary file for the prompt to avoid command line length limits
      const tempFile = path.join(process.cwd(), '.translation-prompt.txt');
      await fs.writeFile(tempFile, prompt, 'utf8');
      
      // Call Claude Code with the prompt file
      const command = `cat "${tempFile}" | claude -p --output-format json --max-turns 1 --dangerously-skip-permissions`;
      
      console.log('🤖 Calling Claude Code...');
      const output = execSync(command, { 
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe'],
        timeout: 60000, // 60 second timeout
        env: {
          ...process.env,
          ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY
        }
      });
      
      // Clean up temp file
      await fs.unlink(tempFile).catch(() => {}); // Ignore cleanup errors
      
      // Parse the JSON response
      const response = JSON.parse(output);
      
      if (response.is_error) {
        throw new Error(`Claude Code error: ${response.result || 'Unknown error'}`);
      }
      
      // Extract the actual result content
      let resultContent = response.result || '';
      
      // Clean up any unwanted preamble or wrapper content
      if (resultContent.includes('```markdown')) {
        // Extract content from markdown code block if present
        const match = resultContent.match(/```markdown\n([\s\S]*?)\n```/);
        if (match && match[1]) {
          resultContent = match[1];
        }
      }
      
      // Remove any instructional preamble
      const lines = resultContent.split('\n');
      const startIndex = lines.findIndex(line => line.startsWith('---') || line.startsWith('#'));
      if (startIndex > 0) {
        resultContent = lines.slice(startIndex).join('\n');
      }
      
      if (!resultContent || resultContent.trim() === '') {
        throw new Error('No translated content returned from Claude Code');
      }
      
      return {
        translatedContent: resultContent.trim(),
        headingMap: {} // We'll extract headings separately if needed
      };
      
    } catch (error) {
      if (error.code === 'ENOENT') {
        throw new Error('Claude Code CLI not found. Please ensure it is installed and in PATH.');
      }
      
      if (error.signal === 'SIGTERM') {
        throw new Error('Claude Code translation timed out');
      }
      
      throw new Error(`Claude Code execution failed: ${error.message}`);
    }
  }

  async sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Helper method to validate Claude Code installation
  static async validateInstallation() {
    try {
      execSync('claude --version', { stdio: 'pipe' });
      return true;
    } catch (error) {
      return false;
    }
  }

  // Helper method to test authentication
  static async testAuthentication() {
    try {
      const testCommand = `echo "test" | claude -p --output-format json --max-turns 1`;
      const output = execSync(testCommand, { 
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe'],
        timeout: 10000
      });
      
      const response = JSON.parse(output);
      return !response.is_error;
    } catch (error) {
      return false;
    }
  }
}

module.exports = ClaudeCodeTranslator;
