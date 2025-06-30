class PRMetadataExtractor {
  constructor(octokit) {
    this.octokit = octokit;
  }

  async extractMetadata(prNumber) {
    console.log(`📋 Extracting metadata for PR #${prNumber}...`);
    
    try {
      // Get PR details
      const { data: pr } = await this.octokit.rest.pulls.get({
        owner: process.env.REPOSITORY_OWNER,
        repo: process.env.REPOSITORY_NAME,
        pull_number: prNumber
      });

      // Get PR reviews to extract reviewers
      const { data: reviews } = await this.octokit.rest.pulls.listReviews({
        owner: process.env.REPOSITORY_OWNER,
        repo: process.env.REPOSITORY_NAME,
        pull_number: prNumber
      });

      // Get requested reviewers
      const { data: requestedReviewers } = await this.octokit.rest.pulls.listRequestedReviewers({
        owner: process.env.REPOSITORY_OWNER,
        repo: process.env.REPOSITORY_NAME,
        pull_number: prNumber
      });

      const metadata = {
        title: pr.title,
        body: pr.body,
        author: pr.user.login,
        branch: pr.head.ref,
        labels: pr.labels.map(label => label.name),
        reviewers: this.extractReviewers(reviews, requestedReviewers),
        assignees: pr.assignees.map(assignee => assignee.login),
        milestone: pr.milestone ? pr.milestone.title : null,
        projects: [], // Will be populated separately if needed
        createdAt: pr.created_at,
        mergedAt: pr.merged_at
      };

      console.log('✅ PR metadata extracted successfully');
      console.log(`📊 Found ${metadata.reviewers.length} reviewers, ${metadata.labels.length} labels`);
      
      return metadata;
    } catch (error) {
      console.error('❌ Failed to extract PR metadata:', error.message);
      
      // Return minimal metadata to continue workflow
      return {
        title: process.env.PR_TITLE || 'Unknown',
        body: process.env.PR_BODY || '',
        author: process.env.PR_AUTHOR || 'unknown',
        branch: process.env.PR_HEAD_REF || 'unknown',
        labels: [],
        reviewers: [],
        assignees: [],
        milestone: null,
        projects: [],
        createdAt: null,
        mergedAt: null
      };
    }
  }

  extractReviewers(reviews, requestedReviewers) {
    const reviewers = new Set();
    
    // Add users who actually reviewed
    reviews.forEach(review => {
      if (review.user && review.user.login) {
        reviewers.add(review.user.login);
      }
    });
    
    // Add users who were requested to review
    requestedReviewers.users.forEach(user => {
      if (user.login) {
        reviewers.add(user.login);
      }
    });
    
    // Convert Set to Array and filter out bots and the PR author
    return Array.from(reviewers).filter(reviewer => {
      return reviewer !== process.env.PR_AUTHOR && 
             !reviewer.includes('[bot]') &&
             reviewer !== 'github-actions[bot]';
    });
  }

  async extractProjectsMetadata(prNumber) {
    console.log(`📋 Extracting projects metadata for PR #${prNumber}...`);
    
    try {
      // Note: GitHub's Projects API is more complex and varies between 
      // classic projects and new projects (beta). This is a simplified version.
      
      // Get repository projects (classic projects)
      const { data: repoProjects } = await this.octokit.rest.projects.listForRepo({
        owner: process.env.REPOSITORY_OWNER,
        repo: process.env.REPOSITORY_NAME
      });

      // For now, we'll return empty array since project association 
      // is complex and varies by project type
      console.log(`ℹ️ Found ${repoProjects.length} repository projects`);
      return [];
      
    } catch (error) {
      console.warn('⚠️ Could not extract projects metadata:', error.message);
      return [];
    }
  }

  async getCommitMetadata(prNumber) {
    console.log(`📋 Extracting commit metadata for PR #${prNumber}...`);
    
    try {
      const { data: commits } = await this.octokit.rest.pulls.listCommits({
        owner: process.env.REPOSITORY_OWNER,
        repo: process.env.REPOSITORY_NAME,
        pull_number: prNumber
      });

      return {
        totalCommits: commits.length,
        firstCommit: commits[0],
        lastCommit: commits[commits.length - 1],
        authors: [...new Set(commits.map(commit => commit.author?.login).filter(Boolean))]
      };
    } catch (error) {
      console.warn('⚠️ Could not extract commit metadata:', error.message);
      return {
        totalCommits: 0,
        firstCommit: null,
        lastCommit: null,
        authors: []
      };
    }
  }

  async getFileChangeStats(prNumber) {
    console.log(`📊 Getting file change statistics for PR #${prNumber}...`);
    
    try {
      const { data: prDetails } = await this.octokit.rest.pulls.get({
        owner: process.env.REPOSITORY_OWNER,
        repo: process.env.REPOSITORY_NAME,
        pull_number: prNumber
      });

      return {
        totalChanges: prDetails.changed_files,
        additions: prDetails.additions,
        deletions: prDetails.deletions,
        changedFiles: prDetails.changed_files
      };
    } catch (error) {
      console.warn('⚠️ Could not get file change stats:', error.message);
      return {
        totalChanges: 0,
        additions: 0,
        deletions: 0,
        changedFiles: 0
      };
    }
  }

  // Helper method to filter metadata for security
  sanitizeMetadata(metadata) {
    // Remove any potentially sensitive information
    const sanitized = { ...metadata };
    
    // Remove email addresses from body text
    if (sanitized.body) {
      sanitized.body = sanitized.body.replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, '[email]');
    }
    
    // Remove tokens or keys that might be in the content
    if (sanitized.body) {
      sanitized.body = sanitized.body.replace(/\b[A-Za-z0-9]{20,}\b/g, '[token]');
    }
    
    return sanitized;
  }

  // Helper method to validate metadata completeness
  validateMetadata(metadata) {
    const issues = [];
    
    if (!metadata.title) {
      issues.push('Missing PR title');
    }
    
    if (!metadata.author) {
      issues.push('Missing PR author');
    }
    
    if (!metadata.branch) {
      issues.push('Missing branch name');
    }
    
    return issues;
  }
}

module.exports = PRMetadataExtractor;
