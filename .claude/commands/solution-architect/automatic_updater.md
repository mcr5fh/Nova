---
description: "Update solution architect commands based on session analysis findings"
allowed-tools: ["Bash", "Read", "Write", "Edit", "Glob", "AskUserQuestion"]
---

# Solution Architect Automatic Updater

You are the final step in a closed feedback loop. Your job is to take planning failure analyses from `nova.db` and determine whether the solution-architect interview commands (`plan.md` and `help.md`) should be improved based on those findings.

## Important Principles

- **Conservative by default.** If the findings don't clearly warrant changes to the interview commands, say so and stop. No changes is a valid outcome.
- **Relevance filtering.** The analysis pipeline identifies general planning failures across all Claude Code sessions. Many of these failures have nothing to do with the solution-architect interview process. Only act on findings that are directly relevant to improving how the interview gathers information about WHAT to build.
- **Output is a PR, not a direct write.** Any changes must go on a new branch and be opened as a pull request for human review.

## Workflow

### Step 1: Load Unreviewed Analysis Findings

Only load findings that haven't already been processed by a previous run of this updater. The `analyses` table has a `metadata` JSON column — processed records get stamped with `"reviewed_by_updater": true`.

```bash
python3 -c "
import db, json
sessions = db.get_all_sessions()
all_findings = []
analysis_ids = []
for s in sessions:
    analyses = db.get_analyses(s['session_id'], analysis_type='planning_failure')
    for a in analyses:
        meta = json.loads(a['metadata']) if a['metadata'] else {}
        if meta.get('reviewed_by_updater'):
            continue
        analysis_ids.append(a['id'])
        findings = json.loads(a['content'])
        for f in findings:
            f['session_id'] = s['session_id']
            f['analysis_id'] = a['id']
            all_findings.append(f)
print(json.dumps({'findings': all_findings, 'analysis_ids': analysis_ids}, indent=2))
"
```

If there are no unreviewed findings, inform the user: "No new (unreviewed) planning failure analyses found. Either run `analyze_session.py` to generate new findings, or all existing findings have already been processed by a previous updater run." Then stop.

Save the list of `analysis_ids` — you will need them in the final step to mark these records as reviewed.

### Step 2: Filter for Relevance

Review each finding and determine if it's relevant to improving the solution-architect interview. A finding is relevant if it suggests improvements to:

- **Probe questions** — better questions for any of the 6 dimensions (solution clarity, user value, scope boundaries, success criteria, technical constraints, edge cases)
- **Dimension coverage thresholds** — evidence that a threshold is too low or too high
- **Examples** — better "good" vs "bad" examples based on real failures
- **Phase guidance** — improvements to how the interview progresses through phases
- **Rules** — improvements to the interview conduct rules (e.g., when to redirect, how to acknowledge answers)
- **Edge case patterns** — new patterns to proactively surface during interviews
- **Sign-off criteria** — evidence the sign-off check is missing something

A finding is NOT relevant if it's about:
- Code implementation failures (nothing to do with solution design interviews)
- Plan mode triggering for code changes
- Task breakdown for implementation work
- Anything about HOW to build rather than WHAT to build

Categorize each finding as `relevant` or `not_relevant` and explain why in one sentence.

### Step 3: Assess Whether Changes Are Warranted

After filtering, evaluate whether the relevant findings justify changes:

- If **zero relevant findings**: Tell the user "No findings are relevant to the solution-architect interview process. No changes needed." Then **mark all loaded analysis records as reviewed** (Step 7) and stop.
- If **relevant findings exist but are too vague or minor**: Tell the user what you found and why it doesn't warrant changes. Then **mark all loaded analysis records as reviewed** (Step 7) and stop.
- If **relevant findings clearly point to specific improvements**: Continue to Step 4.

Use AskUserQuestion to show the user what you found and get confirmation before proceeding:

"I found {N} relevant findings that suggest the following improvements to the solution-architect commands:
{bullet list of proposed changes with reasoning}

Should I proceed with generating these updates on a new branch?"

### Step 4: Read Current Commands

Read these files to understand what currently exists:
- `.claude/commands/solution-architect/plan.md`
- `.claude/commands/solution-architect/help.md`

### Step 5: Generate Updates

For each file, determine what specific sections should change. Focus on:

**In `plan.md` (the interview engine):**
- Dimension probe questions (add/refine questions based on findings)
- Good/bad examples under dimension definitions
- Phase guidance content
- Rules section
- Edge case discovery prompts
- Sign-off check criteria

**In `help.md` (user-facing documentation):**
- Tips section (add tips based on observed failure patterns)
- Dimension table (if thresholds change)
- Any new workflow guidance

**Do NOT change in `plan.md`:**
- The frontmatter (description, argument-hint, allowed-tools)
- The state file JSON schema structure
- The output spec markdown template structure
- The session setup flow
- The commands list
- The coverage level definitions (not_started/weak/partial/strong)

Apply the changes using Edit tool calls to make targeted, minimal modifications.

### Step 6: Create Branch and Open PR

Once the files are updated:

1. Create a new branch:
```bash
git checkout -b auto/solution-architect-update-$(date +%Y%m%d-%H%M%S)
```

2. Stage only the changed command files:
```bash
git add .claude/commands/solution-architect/plan.md .claude/commands/solution-architect/help.md
```

3. Commit with a descriptive message summarizing what findings drove the changes.

4. Push and open a PR:
```bash
git push -u origin HEAD
gh pr create --title "Update solution-architect commands based on session analysis" --body "$(cat <<'EOF'
## Summary
Automated update to solution-architect interview commands based on planning failure analysis findings.

### Changes
{describe what changed and why}

### Findings That Drove Changes
{list the relevant findings with their categories}

### What Was NOT Changed
{list any relevant findings that were considered but not acted on, and why}

---
Generated by `/solution-architect:automatic_updater`
EOF
)"
```

5. Switch back to the original branch:
```bash
git checkout -
```

6. Tell the user: "PR opened: {PR_URL}. Please review the proposed changes to the solution-architect commands."

### Step 7: Mark Findings as Reviewed

**This step runs regardless of outcome** — whether changes were made, findings were irrelevant, or findings were too minor. The point is to never re-process the same analysis records.

For each `analysis_id` collected in Step 1, update its metadata to include `"reviewed_by_updater": true`:

```bash
python3 -c "
import db, json
analysis_ids = {analysis_ids_list}
for aid in analysis_ids:
    with db.get_connection() as conn:
        cursor = db.get_cursor(conn)
        cursor.execute('SELECT metadata FROM analyses WHERE id = ?', (aid,))
        row = cursor.fetchone()
        meta = json.loads(row['metadata']) if row and row['metadata'] else {}
        meta['reviewed_by_updater'] = True
        cursor.execute('UPDATE analyses SET metadata = ? WHERE id = ?', (json.dumps(meta), aid))
print(f'Marked {len(analysis_ids)} analysis record(s) as reviewed.')
"
```

## Begin

Start by running Step 1 to load unreviewed findings from the database.
