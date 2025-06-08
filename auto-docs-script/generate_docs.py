#!/usr/bin/env python3
"""
Script to generate documentation drafts from PR content using Claude API.
This script is intended to be run as part of a GitHub workflow action.
"""

import os
import sys
import json
import argparse
import datetime
from pathlib import Path
import anthropic
import requests
import subprocess

def get_pr_diff(repo, pr_number):
    """Get the content of the PR as a diff."""
    try:
        # Use GitHub CLI to get diff
        result = subprocess.run(
            ["gh", "pr", "diff", str(pr_number)],
            capture_output=True,
            text=True,
            check=True
        )
        return result.stdout
    except subprocess.CalledProcessError as e:
        print(f"Error fetching PR diff: {e}")
        print(f"stderr: {e.stderr}")
        return None

def get_pr_files(repo, pr_number):
    """Get the list of files changed in the PR."""
    try:
        result = subprocess.run(
            ["gh", "pr", "view", str(pr_number), "--json", "files"],
            capture_output=True,
            text=True,
            check=True
        )
        files_data = json.loads(result.stdout)
        return files_data.get("files", [])
    except subprocess.CalledProcessError as e:
        print(f"Error fetching PR files: {e}")
        print(f"stderr: {e.stderr}")
        return []

def generate_documentation(pr_data, diff_content, files_changed):
    """Generate documentation using Claude API."""
    api_key = os.environ.get("CLAUDE_API_KEY_ACTION_AUTO_DOCS")
    if not api_key:
        print("Error: The CLAUDE_API_KEY_ACTION_AUTO_DOCS environment variable is not set.")
        sys.exit(1)

    client = anthropic.Anthropic(api_key=api_key)
    
    # Construct the prompt for Claude
    prompt = f"""
You are a technical writer creating documentation for a new feature that was just merged into a software project.

Here is information about the feature from the pull request:

- Title: {pr_data['title']}
- Description: {pr_data['body']}
- PR URL: {pr_data['url']}

Files changed in this PR:
{json.dumps([f['path'] for f in files_changed], indent=2)}

Here is the diff showing the changes:
```diff
{diff_content[:10000] if diff_content else "No diff available"}
```

Based on this information, generate comprehensive documentation for this new feature in MDX (.mdx) format. Include the following sections:

1. Overview - A brief description of the feature (Don't include this as a heading. Instead, put the overview content below the title.)
2. Purpose - Why this feature was added and what problem it solves
3. How this feature works - Technical explanation of the implementation
4. Usage - How to use this feature, with code examples if applicable
5. Configuration - Any configuration options or settings
6. Related features or components - How this feature interacts with other parts of the system

Format the documentation by using proper Markdown syntax with clear headings, code blocks, tables, etc. and by using Markdown best practices.

Make the headings use sentence-style capitalization (e.g., "How to use this feature" instead of "How to Use This Feature" and "HOW TO USE THIS FEATURE"). Do NOT capitalize the first letter of each word in headings.

Never stack headings. There should be no headings that are not followed by content.
"""

    # Call Claude API
    try:
        response = client.messages.create(
            model="claude-3-5-haiku-latest",
            max_tokens=8192,
            temperature=0.7,
            system="You are an expert technical writer who creates clear, concise documentation for software features.",
            messages=[
                {"role": "user", "content": prompt}
            ]
        )
        return response.content[0].text
    except Exception as e:
        print(f"Error calling Claude API: {e}")
        return None

def main():
    parser = argparse.ArgumentParser(description='Generate documentation from PR content')
    parser.add_argument('--pr-number', required=True, help='PR number')
    parser.add_argument('--pr-url', required=True, help='PR URL')
    parser.add_argument('--pr-title', required=True, help='PR title')
    parser.add_argument('--pr-body', required=True, help='PR body')
    parser.add_argument('--repo', required=True, help='Repository name')
    parser.add_argument('--output-dir', default='docs/auto-generated', help='Output directory')
    parser.add_argument('--file-extension', default='mdx', help='File extension for the generated doc')
    
    args = parser.parse_args()
    
    pr_data = {
        'number': args.pr_number,
        'url': args.pr_url,
        'title': args.pr_title,
        'body': args.pr_body
    }
    
    # Get PR content
    diff_content = get_pr_diff(args.repo, args.pr_number)
    files_changed = get_pr_files(args.repo, args.pr_number)
    
    # Generate documentation
    doc_content = generate_documentation(pr_data, diff_content, files_changed)
    
    if not doc_content:
        print("Failed to generate documentation.")
        sys.exit(1)
    
    # Sanitize title for filename
    safe_title = args.pr_title.lower().replace(' ', '-')
    safe_title = ''.join(c for c in safe_title if c.isalnum() or c == '-')
      # Create output filename
    filename = f"{safe_title}.{args.file_extension}"
    output_path = os.path.join(args.output_dir, filename)
    
    # Make sure the output directory exists
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    
    # Add frontmatter to the content
    frontmatter = f"""---
tags: 
  - New feature
---

"""
    
    # Write the documentation
    with open(output_path, 'w') as f:
        f.write(frontmatter + doc_content)
    
    print(f"Documentation generated and saved to {output_path}.")
    
if __name__ == "__main__":
    main()
