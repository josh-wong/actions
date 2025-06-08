#!/bin/bash
# Script to install dependencies for auto-docs generation

# Ensure the script fails on any error
set -e

echo "Installing dependencies for auto-docs generation..."

# Install Python packages
python -m pip install --upgrade pip
pip install anthropic requests

# Check if GitHub CLI is installed
if ! command -v gh &> /dev/null; then
    echo "GitHub CLI not found, installing..."
    
    # Different installation methods based on the OS
    if [ "$(uname)" == "Darwin" ]; then
        # macOS
        brew install gh
    elif [ "$(uname)" == "Linux" ]; then
        # Linux
        curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg | sudo dd of=/usr/share/keyrings/githubcli-archive-keyring.gpg
        echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" | sudo tee /etc/apt/sources.list.d/github-cli.list > /dev/null
        sudo apt update
        sudo apt install gh
    else
        echo "Unsupported OS for automatic GitHub CLI installation."
        echo "Please install GitHub CLI manually: https://github.com/cli/cli#installation"
        exit 1
    fi
fi

# Verify installations
echo "Verifying installations..."
pip list | grep anthropic
gh --version

echo "All dependencies installed successfully."
echo "Note: Make sure to set the CLAUDE_API_KEY_ACTION_AUTO_DOCS environment variable before using the scripts."
