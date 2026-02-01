# Planning System Prompt Auto-Update Pipeline

## Objective

Build a CLI pipeline that analyzes Claude Code session transcripts to identify planning failures, then automatically improves the planning agent's system prompt so the same mistakes don't recur.

---

## Step 1: Extract User Messages from JSONL Transcripts

**Input:** Claude Code session JSONL files (e.g. `~/.claude/projects/<project>/<session-id>.jsonl`)

**What to extract:** Only real human messages — filter by:
- `type === "user"`
- `message.content` is a **string** (not an array — arrays are tool results)

**Storage:** SQLite database with schema:

```sql
CREATE TABLE sessions (
    session_id TEXT PRIMARY KEY,
    git_branch TEXT,
    cwd TEXT,
    created_at TIMESTAMP
);

CREATE TABLE messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT REFERENCES sessions(session_id),
    uuid TEXT UNIQUE,
    content TEXT,
    timestamp TIMESTAMP,
    message_index INTEGER  -- order within session
);
```

**CLI interface:**
```bash
python ingest.py <path-to-jsonl>
# or batch:
python ingest.py <directory-of-jsonl-files>
```

---

## Step 2: Analyze Session Messages with Claude API

**Goal:** For each session, send the sequence of user messages to Claude and ask: *"Which of these messages indicate something the planning phase should have anticipated?"*

**What counts as a planning failure:**
- User had to clarify requirements that were stated or inferable from the original task
- User had to redirect the AI because it misunderstood scope
- User had to provide information about the codebase that the planner should have discovered
- User had to correct an approach that a good plan would have ruled out
- User asked "why did you do X?" indicating a bad decision was made

**Analysis prompt (sent to Claude API):**
Given the user messages from a coding session, identify planning failures — moments where the user had to intervene because the initial plan was insufficient. For each failure, output:
- The message that indicates the failure
- What category it falls into (missing requirements, wrong approach, missing context, scope misunderstanding)
- What the planning prompt should have done differently

**Output:** Store analysis results back in SQLite:

```sql
CREATE TABLE analyses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT REFERENCES sessions(session_id),
    message_uuid TEXT REFERENCES messages(uuid),
    failure_category TEXT,
    description TEXT,
    suggested_improvement TEXT,
    analyzed_at TIMESTAMP
);
```

**CLI interface:**
```bash
python analyze.py --session <session-id>
# or all unanalyzed:
python analyze.py --all
```

Requires `ANTHROPIC_API_KEY` env var.

---

## Step 3: Update the Planning System Prompt

**Goal:** Take the accumulated analysis results and generate a concrete diff to the planning system prompt.

**Process:**
1. Read the current planning system prompt (location TBD — user will specify)
2. Read all unaddressed analysis results from the DB
3. Send both to Claude API: "Given these observed planning failures, update this system prompt to prevent them"
4. Spawn a Claude Code session that:
   - Creates a new branch
   - Applies the system prompt changes
   - Opens a PR with the analysis as the PR description

**CLI interface:**
```bash
python update_prompt.py --prompt-file <path-to-planning-prompt>
```

---

## File Structure

```
tools/prompt_updater/
    ingest.py          # Step 1: JSONL -> SQLite
    analyze.py         # Step 2: Claude API analysis
    update_prompt.py   # Step 3: Generate prompt update + PR
    db.py              # Shared SQLite helpers
    sessions.db        # SQLite database (gitignored)
```

---

## Open Questions

- **Planning prompt location:** Where does the planning system prompt live? (Needed for Step 3)
- **API key management:** Env var or config file?
- **Batch vs single:** Should Step 2 analyze one session at a time or batch multiple sessions into a single analysis call for pattern detection?
- **PR automation:** Exact mechanism for spawning Claude Code to create the PR in Step 3
