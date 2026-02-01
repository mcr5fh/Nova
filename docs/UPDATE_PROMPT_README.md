# Auto-Update Planning System Prompt

This script orchestrates the complete workflow from U1 through P2 to automatically update planning system prompts based on analyzed failures.

## Workflow Steps

The script executes these steps in sequence:

- **U1**: Load current planning system prompt from file
- **U2**: Query and aggregate unaddressed planning failure analyses from database
- **U3**: Send current prompt + aggregated findings to Claude API for generation of updated prompt
- **P1**: Write the updated prompt to a file
- **P2**: (Optional) Create a git branch, commit, and push for PR creation

## Prerequisites

1. Set your Anthropic API key:
```bash
export ANTHROPIC_API_KEY='your-api-key-here'
```

2. Ensure database has been initialized and contains analysis data:
```bash
python3 db.py
python3 analyze_session.py --all
```

## Usage

### Basic Usage

Update a prompt file and save to default output location:

```bash
python3 update_prompt.py --prompt-file path/to/current_prompt.txt
```

This will:
- Load the prompt from the specified file
- Query unaddressed analyses from the database
- Generate an updated prompt via Claude API
- Save the result to `updated_planning_prompt.txt`

### Custom Output Location

Specify where to save the updated prompt:

```bash
python3 update_prompt.py --prompt-file prompts/planning.txt --output prompts/planning_v2.txt
```

### Create a PR

Automatically create a git branch and push changes:

```bash
python3 update_prompt.py --prompt-file prompts/planning.txt --create-pr
```

This will:
- Create a branch named `auto-update-system-prompt` (customizable with `--branch`)
- Stage and commit the updated prompt file
- Push to remote repository
- Print instructions for creating a PR via `gh` CLI

### Custom Branch Name

Use a custom branch name for the PR:

```bash
python3 update_prompt.py --prompt-file prompts/planning.txt --create-pr --branch feature/improved-planning-2026-01
```

### Dry Run Mode

See what would happen without making any changes:

```bash
python3 update_prompt.py --prompt-file prompts/planning.txt --dry-run
```

This is useful for:
- Verifying the prompt file path is correct
- Checking how many unaddressed analyses exist
- Testing the workflow without consuming API credits

## Command-Line Options

| Option | Required | Default | Description |
|--------|----------|---------|-------------|
| `--prompt-file` | Yes | - | Path to current planning system prompt file |
| `--output` | No | `updated_planning_prompt.txt` | Path to save updated prompt |
| `--create-pr` | No | `false` | Create git branch and push for PR |
| `--branch` | No | `auto-update-system-prompt` | Branch name when using `--create-pr` |
| `--dry-run` | No | `false` | Show actions without making changes |

## Output

The script provides detailed progress output:

```
================================================================================
PLANNING PROMPT AUTO-UPDATER
================================================================================

Step U1: Loading current planning prompt...
  ✓ Loaded 2847 characters from prompts/planning.txt

Step U2: Querying and aggregating unaddressed analyses...
  ✓ Found 3 failure categories:
    - missing_plan_mode: 12 occurrences
    - insufficient_clarification: 8 occurrences
    - premature_implementation: 5 occurrences

Step U3: Generating updated prompt via Claude API...
Sending request to Claude API...
Input: 2847 chars of current prompt
Input: 3 failure categories

API Response received:
  Tokens used - Input: 3421, Output: 1876
  Stop reason: end_turn
  ✓ Generated updated prompt (3245 characters)

Step P1: Writing updated prompt to updated_planning_prompt.txt...
✓ Updated prompt saved to: updated_planning_prompt.txt

Skipping PR creation (use --create-pr to enable)

================================================================================
COMPLETE
================================================================================

Updated prompt saved to: updated_planning_prompt.txt
```

## Error Handling

The script handles various error conditions:

- **Missing API key**: Exits with error message
- **Prompt file not found**: Exits with clear error
- **Empty prompt file**: Exits with error
- **No unaddressed analyses**: Exits gracefully (nothing to update)
- **API errors**: Catches and reports Anthropic API errors
- **Git errors**: Reports issues with branch creation, commit, or push
- **File write errors**: Reports IO errors when saving output

## Integration with Workflow

This script is the final stage (U1-P2) in the complete planning prompt auto-update system:

1. **Foundation (F1-F3)**: Database schema and JSONL parsing
2. **Ingestion (I1-I4)**: Import session data from JSONL files
3. **Analysis (A1-A3, S1-S3)**: Analyze sessions for planning failures
4. **Prompt Update (U1-U3, P1-P2)**: This script - generate updated prompts

## Example Complete Workflow

```bash
# 1. Initialize database
python3 db.py

# 2. Import session data
python3 program_nova/session_importer.py ~/.claude/projects/

# 3. Analyze sessions for planning failures
python3 analyze_session.py --all

# 4. Generate updated prompt and create PR
export ANTHROPIC_API_KEY='sk-...'
python3 update_prompt.py --prompt-file prompts/planning.txt --create-pr

# 5. Create the PR
gh pr create --title "Auto-update planning system prompt" --body "$(cat pr_description.txt)"
```

## Notes

- The script uses Claude API model `claude-3-5-sonnet-20241022` with `max_tokens=4000` and `temperature=0.3` for prompt generation
- Commit messages are automatically generated summarizing the failure categories addressed
- The `--dry-run` flag is useful for testing without consuming API credits or making changes
- When using `--create-pr`, ensure you're on the correct base branch before running
