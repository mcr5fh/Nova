# pr-comments

Fetches and displays all comments from a GitHub pull request, including issue comments and code review comments.

The most recent comments should be given the highest priority.

## Usage

```
/pr-comments [PR_URL]
```

If no PR URL is provided, it will attempt to get the current PR from the branch.

## Steps

1. Parse the PR URL or get current PR info using `gh pr view`
2. Fetch issue-level comments using `gh api /repos/{owner}/{repo}/issues/{number}/comments`
3. Fetch review comments using `gh api /repos/{owner}/{repo}/pulls/{number}/comments`
4. Get all review IDs and fetch comments from each review
5. Format and display all comments in a readable structure

## Output Format

Comments are displayed as:

- **Issue Comments**: Top-level comments on the PR
- **Review Comments**: Inline code comments with file context and diff hunks

Each comment shows:

- Author (@username)
- File and line number (for code comments)
- Diff context (for code comments)
- Comment text (quoted)
- Replies (indented)
- Timestamp

## Implementation

```bash
# Get PR info
if [[ -n "$1" ]]; then
  # Parse URL like https://github.com/owner/repo/pull/123
  PR_URL="$1"
  OWNER=$(echo "$PR_URL" | sed -E 's|https://github.com/([^/]+)/.*|\1|')
  REPO=$(echo "$PR_URL" | sed -E 's|https://github.com/[^/]+/([^/]+)/.*|\1|')
  PR_NUM=$(echo "$PR_URL" | sed -E 's|.*/pull/([0-9]+).*|\1|')
else
  # Get current PR
  PR_INFO=$(gh pr view --json number,headRepository)
  PR_NUM=$(echo "$PR_INFO" | jq -r '.number')
  REPO=$(echo "$PR_INFO" | jq -r '.headRepository.name')
  OWNER=$(gh repo view --json owner -q '.owner.login')
fi

# Fetch issue comments
echo "## PR Comments"
echo ""
gh api "/repos/$OWNER/$REPO/issues/$PR_NUM/comments" --paginate | jq -r '.[] |
  "- @\(.user.login) (\(.created_at | sub("T.*"; ""))):\n  > \(.body | split("\n") | join("\n  > "))\n"'

# Fetch review comments
echo "## Code Review Comments"
echo ""

# Get all reviews and their comments
gh api "/repos/$OWNER/$REPO/pulls/$PR_NUM/reviews" --paginate | jq -r '.[].id' | sort -u | while read -r review_id; do
  gh api "/repos/$OWNER/$REPO/pulls/$PR_NUM/reviews/$review_id/comments" 2>/dev/null | jq -r '.[] |
    "- @\(.user.login) \(.path)#\(.line // .original_line // ""):\n  ```diff\n\(.diff_hunk | split("\n") | .[0:5] | join("\n"))\n  ```\n  > \(.body | split("\n") | join("\n  > "))\n"'
done

# Also get direct PR comments not part of reviews
gh api "/repos/$OWNER/$REPO/pulls/$PR_NUM/comments" --paginate | jq -r '.[] |
  select(.pull_request_review_id == null) |
  "- @\(.user.login) \(.path)#\(.line // .original_line // ""):\n  ```diff\n\(.diff_hunk | split("\n") | .[0:5] | join("\n"))\n  ```\n  > \(.body | split("\n") | join("\n  > "))\n"'
```

## Example Output

```markdown
## PR Comments

- @mcr5fh (2025-08-12):
  > @claude please review
  >
  > @greptile please review - I haven't read any of this code

- @claude[bot] (2025-08-12):
  > **Claude finished @mcr5fh's task**
  >
  > This is an impressive memory optimization refactor...

## Code Review Comments

- @mcr5fh backend/src/hercules/clients/sample_processor.py#410:
  ```diff
  +        # Use SpooledTemporaryFile to avoid memory for small files, disk for large
  +        # Max size of 10MB in memory before spilling to disk
  +        with tempfile.SpooledTemporaryFile(max_size=10 * 1024 * 1024) as temp_file:
  ```

  > we need to drop this to like 1.5MB cause we only have 4GB of ram on the host

- @greptile-apps[bot] backend/src/hercules/db/postgres_client.py#1431:

  ```diff
  +                    s3_client.copy_object(new_samples, final_key)
  ```

  > logic: Missing error handling - `copy_object` could fail but isn't wrapped in try-catch
>
```
