import os
import openai
import sys
from pathlib import Path

openai.api_key = os.getenv("OPENAI_API_KEY_ACTION_TRANSLATE_DOCS")

def translate_file(source_path, output_dir, file_extension=None):
    with open(source_path, "r", encoding="utf-8") as f:
        content = f.read()

    prompt = f"Translate the following Markdown documentation from English to Japanese:\n\n{content}"

    try:
        response = openai.ChatCompletion.create(
            model="gpt-4o",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.3,
        )
        translation = response['choices'][0]['message']['content']

        # Get the relative path from source_path
        source_rel_path = Path(source_path).name

        # Determine target file extension
        if file_extension:
            target_ext = file_extension
        else:
            target_ext = Path(source_path).suffix.lstrip('.')

        # Create target path in the specified output directory
        target_path = Path(output_dir) / f"{Path(source_path).stem}.{target_ext}"

        print(f"Saving translation to {target_path}")
        os.makedirs(os.path.dirname(target_path), exist_ok=True)
        with open(target_path, "w", encoding="utf-8") as f:
            f.write(translation)
        print(f"Successfully translated {source_path} to {target_path}")

    except Exception as e:
        print(f"Error translating {source_path}: {str(e)}")
        raise e

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python auto-translate.py <source_file> [output_dir] [file_extension]")
        sys.exit(1)

    source = Path(sys.argv[1])

    output_dir = "docs/ja-jp"  # Default output directory
    if len(sys.argv) > 2:
        output_dir = sys.argv[2]

    file_extension = None
    if len(sys.argv) > 3:
        file_extension = sys.argv[3]

    translate_file(source, output_dir, file_extension)
