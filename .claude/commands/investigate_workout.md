# Investigate Workout Issues

You are tasked with investigating user workout issues by searching Render logs. This command helps debug problems like workout merging failures, sync issues, and webhook problems.

## Required Parameters

When this command is invoked, you MUST have:

1. **user_id** - The Firebase user ID (required)
2. **workout_id** - One or more workout IDs to investigate (required)

If these are not provided, respond with:

```
I need the following information to investigate:

1. **user_id**: The Firebase user ID (e.g., NfTY0It7rKSTDme0oZR8oCpyTnj2)
2. **workout_id**: One or more workout IDs to investigate (e.g., 744a32b3-f303-42a9-b893-3cc0963c3c99)

Optional context:
- Description of the issue (e.g., "workouts didn't merge", "Apple watch data missing")
- Approximate time when the issue occurred
- Any other relevant details

Example: `/investigate_workout user_id: NfTY0It7rKSTDme0oZR8oCpyTnj2 workout_id: 744a32b3-f303-42a9-b893-3cc0963c3c99`
```

Then wait for the user's input.

## Render Service Reference

### Production Services

| Service Name | Service ID | Purpose | When to Search |
|-------------|------------|---------|----------------|
| **project-mitochondria-prod** | `srv-cntnqqect0pc73a16m30` | Main mobile API - all traffic from the phone app (workouts, exercises, user actions) | Default for most issues |
| **mito-webhooks-prod** | `srv-cunmlbdumphs73bogijg` | External webhooks - Terra (fitness devices), Stripe (payments), RevenueCat (subscriptions) | Device sync issues, external data |
| **mito-inngest-prod** | `srv-cumvmtdsvqrc73fm2940` | Async background workflows - workout processing, notifications, scheduled jobs | Background processing, delayed tasks |

### Staging Services

| Service Name | Service ID | Purpose |
|-------------|------------|---------|
| **ProjectMitochondria-staging** | `srv-d4nkf0khg0os739fhar0` | Staging API |
| **ProjectMitochondria-staging-inngest** | `srv-cvl01ibe5dus73bughig` | Staging async worker |

### Workspace

Before searching logs, you must select the **HYBRD Infra** workspace:

```
Workspace ID: tea-cs1d6v3tq21c73eomg00
```

## Investigation Workflow

### Step 1: Determine Which Service to Search

Based on the issue type, search the appropriate service(s):

**For workout sync issues (Apple Watch, Garmin, Strava, etc.):**

1. First search **mito-webhooks-prod** (`srv-cunmlbdumphs73bogijg`) - Terra webhook events show incoming device data
2. Then search **project-mitochondria-prod** (`srv-cntnqqect0pc73a16m30`) - See how the API processed the data

**For live workout issues:**

1. Search **project-mitochondria-prod** (`srv-cntnqqect0pc73a16m30`) - Live workouts are created via the mobile API

**For workout merging issues:**

1. Search **project-mitochondria-prod** (`srv-cntnqqect0pc73a16m30`) - Merging logic runs in the main API
2. Also check **mito-webhooks-prod** (`srv-cunmlbdumphs73bogijg`) - If merging involves external device data

**For background processing issues:**

1. Search **mito-inngest-prod** (`srv-cumvmtdsvqrc73fm2940`) - Async workflows and background jobs

### Step 2: Fetch and Save Logs to Disk

**IMPORTANT**: ALWAYS write logs to disk first, then search with `jq` or `grep`. Never try to read large log outputs directly - they can be huge and overwhelm the context.

Use the Render MCP to fetch logs:

- `mcp__render__select_workspace` - Select the HYBRD Infra workspace first
- `mcp__render__list_logs` - Get logs from a specific service

**Workflow:**

1. Select the HYBRD Infra workspace (`tea-cs1d6v3tq21c73eomg00`)
2. Fetch logs and write them to a temp file
3. Use `jq`, `grep`, or other CLI tools to search the logs on disk
4. Never try to display raw log output in the conversation

**Example workflow:**

```bash
# Create a temp directory for logs
mkdir -p /tmp/render-logs

# After fetching logs via MCP, save to file, then search:

# Search for a specific user_id
jq 'select(.message | contains("NfTY0It7rKSTDme0oZR8oCpyTnj2"))' /tmp/render-logs/webhooks.json

# Search for a workout_id
jq 'select(.message | contains("744a32b3-f303-42a9-b893-3cc0963c3c99"))' /tmp/render-logs/api.json

# Find errors
jq 'select(.level == "error")' /tmp/render-logs/api.json

# Get timeline of events (sorted by timestamp)
jq -s 'sort_by(.timestamp)' /tmp/render-logs/*.json

# Search with grep for quick filtering
grep -h "merge" /tmp/render-logs/*.json | jq .
```

**MCP call parameters:**

```
mcp__render__list_logs with:
  resource: ["srv-cntnqqect0pc73a16m30"]  # Service ID
  text: ["user_id_or_workout_id"]          # Filter text
  startTime: "2025-01-07T00:00:00Z"        # RFC3339 format
  endTime: "2025-01-08T00:00:00Z"          # RFC3339 format
  limit: 100                                # Max logs per request
```

**Service IDs for quick reference:**

- Main API: `srv-cntnqqect0pc73a16m30`
- Webhooks: `srv-cunmlbdumphs73bogijg`
- Inngest: `srv-cumvmtdsvqrc73fm2940`

### Step 3: Analyze Findings

When reviewing logs, look for:

1. **For merge issues:**
   - Start time comparisons between workouts
   - Overlap detection logic
   - Any "no merge" decisions and their reasons

2. **For sync issues:**
   - Terra webhook payload timestamps
   - Data transformation steps
   - Database insert/update operations

3. **For timing issues:**
   - Compare `started_at`, `ended_at`, `created_at` timestamps
   - Check timezone handling
   - Look for epoch vs datetime conversions

### Step 4: Present Findings

Structure your findings as:

```markdown
## Investigation Summary

**User ID**: [user_id]
**Workout ID(s)**: [workout_ids]
**Issue**: [brief description]

## Timeline of Events

| Time | Service | Event |
|------|---------|-------|
| ... | ... | ... |

## Root Cause Analysis

[What caused the issue based on log evidence]

## Key Log Entries

[Relevant log snippets with timestamps]

## Recommendations

[If applicable, what might fix the issue]
```

## Common Issues Reference

### Workout Merge Failures

- **Symptom**: Two workouts that should be merged remain separate
- **Common causes**:
  - Start times don't overlap (threshold issues)
  - End time used as start time for HYBRID AI workouts
  - Timezone conversion errors
- **Look for**: `merge`, `overlap`, `started_at`, `ended_at` in logs

### Terra Webhook Issues

- **Symptom**: Device data not appearing in app
- **Common causes**:
  - Webhook delivery failure
  - Data transformation errors
  - Database constraint violations
- **Look for**: `terra`, `webhook`, `payload`, error messages

### Live Workout Sync

- **Symptom**: Live workout data not syncing with device data
- **Common causes**:
  - Timing mismatch between live session and device recording
  - Device data arriving before/after live workout ends
- **Look for**: `live_workout`, `sync`, `session`

## Important Notes

- Always start with the most relevant service based on the issue type
- Search for both user_id AND workout_id to get complete context
- Pay attention to timestamps - they tell the story
- Look for patterns across multiple log entries
- If logs don't show the issue, the problem might be on the frontend
