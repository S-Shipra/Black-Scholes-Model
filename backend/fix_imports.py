import os
import re

root = os.path.join(os.path.dirname(os.path.abspath(__file__)), "backend")

patterns = [
    (r'from agents\.', 'from backend.agents.'),
    (r'from utils\.', 'from backend.utils.'),
    (r'import agents\.', 'import backend.agents.'),
    (r'import utils\.', 'import backend.utils.'),
]

for dirpath, _, filenames in os.walk(root):
    for filename in filenames:
        if not filename.endswith(".py"):
            continue
        filepath = os.path.join(dirpath, filename)
        with open(filepath, "r", encoding="utf-8") as f:
            content = f.read()
        new_content = content
        for pattern, replacement in patterns:
            new_content = re.sub(pattern, replacement, new_content)
        if new_content != content:
            with open(filepath, "w", encoding="utf-8") as f:
                f.write(new_content)
            print(f"Fixed: {filepath}")

print("Done!")