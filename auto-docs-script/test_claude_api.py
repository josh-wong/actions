#!/usr/bin/env python3
"""
This is a simple test script to verify Claude API connection and functionality.
"""

import os
import sys
import anthropic

def test_claude_connection():
    """Test the connection to the Claude API."""
    api_key = os.environ.get("CLAUDE_API_KEY_ACTION_AUTO_DOCS")
    if not api_key:
        print("Error: The CLAUDE_API_KEY_ACTION_AUTO_DOCS environment variable is not set.")
        sys.exit(1)

    try:
        client = anthropic.Anthropic(api_key=api_key)
        
        response = client.messages.create(
            model="claude-3-5-haiku-latest",
            max_tokens=8192, # Maximum number of tokens in the response
            temperature=0.7, # Randomness control (0.0-1.0)
            messages=[
                {"role": "user", "content": "Hello, this is a test connection to the Claude API. If you receive this message, please respond with 'Connection successful' and mention what you are."}
            ]
        )
        
        print("API Response:")
        print(response.content[0].text)
        print("\nConnection test completed successfully.")
        
    except Exception as e:
        print(f"Error testing Claude API connection: {e}")
        sys.exit(1)

if __name__ == "__main__":
    test_claude_connection()
