# Recover Deleted Files from Session History

Recover files that were deleted but were previously written in Claude Code sessions. This searches through session JSONL files for Write tool calls and Bash heredoc writes.

## Arguments

- `$ARGUMENTS` - Space-separated list of file names or patterns to search for (e.g., "2026-01-19-hyrox" or "myfile.md")

## Process

1. **Identify the session directory:**

   ```bash
   # The session directory is based on the current working directory
   SESSION_DIR="$HOME/.claude/projects/-$(pwd | tr '/' '-')"
   ```

2. **Search for deleted files using this Python script:**

   Create and run a Python script that:
   - Searches all `.jsonl` files in the session directory (including `agent-*.jsonl`)
   - Looks for Write tool calls with matching file paths
   - Looks for Bash heredoc writes (`cat > path << 'EOF'`) with matching file paths
   - Extracts the content and saves to `/tmp/recovered_<filename>`

   ```python
   import json
   import re
   import os
   from glob import glob

   # Get search patterns from arguments
   patterns = "$ARGUMENTS".split()

   session_dir = os.path.expanduser("~/.claude/projects/-" + os.getcwd().replace("/", "-"))
   session_files = glob(f"{session_dir}/*.jsonl") + glob(f"{session_dir}/agent-*.jsonl")

   results = {}

   for session_file in session_files:
       try:
           with open(session_file, 'r') as f:
               for line_num, line in enumerate(f, 1):
                   for pattern in patterns:
                       if pattern in line:
                           try:
                               data = json.loads(line)
                               msg = data.get('message', {})
                               content = msg.get('content', [])

                               if isinstance(content, list):
                                   for item in content:
                                       if isinstance(item, dict) and item.get('type') == 'tool_use':
                                           tool_name = item.get('name', '')
                                           inp = item.get('input', {})

                                           # Check for Bash heredoc
                                           if tool_name == 'Bash':
                                               cmd = inp.get('command', '')
                                               if pattern in cmd and "<< 'EOF'" in cmd:
                                                   # Extract filename from cat > path or similar
                                                   path_match = re.search(r'(?:cat\s*>\s*|>\s*)([^\s<]+)', cmd)
                                                   if path_match:
                                                       file_path = path_match.group(1)
                                                       file_name = os.path.basename(file_path)
                                                       content_match = re.search(r"<< 'EOF'\n(.+?)\nEOF", cmd, re.DOTALL)
                                                       if content_match and file_name not in results:
                                                           results[file_name] = {
                                                               'content': content_match.group(1),
                                                               'original_path': file_path,
                                                               'source': os.path.basename(session_file)
                                                           }

                                           # Check for Write tool
                                           elif tool_name == 'Write':
                                               file_path = inp.get('file_path', '')
                                               file_content = inp.get('content', '')
                                               if pattern in file_path and file_content:
                                                   file_name = os.path.basename(file_path)
                                                   if file_name not in results:
                                                       results[file_name] = {
                                                           'content': file_content,
                                                           'original_path': file_path,
                                                           'source': os.path.basename(session_file)
                                                       }
                           except:
                               pass
       except:
           pass

   # Report and save
   print(f"Found {len(results)} files matching patterns: {patterns}")
   for file_name, data in results.items():
       output_path = f"/tmp/recovered_{file_name}"
       with open(output_path, 'w') as f:
           f.write(data['content'])
       print(f"  - {file_name} ({len(data['content'])} chars)")
       print(f"    Original: {data['original_path']}")
       print(f"    Saved to: {output_path}")
   ```

3. **Present findings to user:**
   - List all recovered files with their sizes
   - Show the original paths where they belonged
   - Show where the recovered versions are saved (`/tmp/recovered_*`)

4. **Ask user which files to restore:**
   - Present options for each file: restore to original location, restore to different location, or skip
   - For files being restored, copy from `/tmp/recovered_*` to the target location

5. **Restore confirmed files:**

   ```bash
   # For each confirmed file:
   mkdir -p "$(dirname "$ORIGINAL_PATH")"
   cp "/tmp/recovered_$FILENAME" "$ORIGINAL_PATH"
   ```

## Example Usage

```
/recover_files 2026-01-19-hyrox
/recover_files mycomponent.tsx utils.ts
/recover_files "training-plan"
```

## Notes

- This searches the current project's session history only
- Files are recovered from Write tool calls and Bash heredoc patterns
- Multiple sessions may have different versions - the script finds the first match
- Recovered files are saved to `/tmp/` first for review before restoration
