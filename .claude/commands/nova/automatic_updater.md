---
description: "Update nova orchestrator commands based on session analysis findings"
allowed-tools: ["Bash", "Read", "Write", "Edit", "Glob", "AskUserQuestion"]
---

# Nova Automatic Updater

You are the final step in a closed feedback loop. Your job is to take planning failure analyses from `nova.db` and determine whether the Nova orchestrator commands (`plan.md` and `help.md`) should be improved based on those findings.

## Important Principles

- **Conservative by default.** If the findings don't clearly warrant changes to the orchestrator commands, say so and stop. No changes is a valid outcome.
- **Relevance filtering.** The analysis pipeline identifies general planning failures across all Claude Code sessions. Many of these failures have nothing to do with the Nova orchestrator. Only act on findings that are directly relevant to improving how the orchestrator coordinates the planning workflow.
- **Output is a PR, not a direct write.** Any changes must go on a new branch and be opened as a pull request for human review.

## Workflow

### Step 1: Load Unreviewed Analysis Findings

Only load findings that haven't already been processed by a previous run of this updater. The `analyses` table has a `metadata` JSON column — processed records get stamped with `"reviewed_by_nova_updater": true`.

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
        if meta.get('reviewed_by_nova_updater'):
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

Review each finding and determine if it's relevant to improving the Nova orchestrator. A finding is relevant if it suggests improvements to:

- **Phase detection logic** — improvements to how Nova determines which phase the user is in based on existing artifacts
- **Phase transition guidance** — better instructions for when to advance phases or when to recommend going back
- **Sub-skill routing** — improvements to how Nova directs users to the right sub-skill (/problem:plan, /solution-architect:plan, /solution-critic:plan, /create-plan)
- **Skip behavior** — evidence that skip warnings are inadequate or too aggressive
- **Progress display** — improvements to how progress is shown to users
- **Discovery phase assessment** — better heuristics for determining if users should do problem definition
- **State management** — improvements to how state is tracked and restored across sessions
- **Handoff instructions** — clearer guidance when routing users to sub-skills

A finding is NOT relevant if it's about:
- Internal workings of sub-skills (solution-architect interview questions, problem definition prompts, etc.) — those have their own updaters
- Code implementation failures (nothing to do with workflow orchestration)
- Plan mode triggering for code changes
- Task breakdown for implementation work
- Anything about WHAT to build or HOW to build — Nova only coordinates the journey

Categorize each finding as `relevant` or `not_relevant` and explain why in one sentence.

### Step 3: Assess Whether Changes Are Warranted

After filtering, evaluate whether the relevant findings justify changes:

- If **zero relevant findings**: Tell the user "No findings are relevant to the Nova orchestrator. No changes needed." Then **mark all loaded analysis records as reviewed** (Step 7) and stop.
- If **relevant findings exist but are too vague or minor**: Tell the user what you found and why it doesn't warrant changes. Then **mark all loaded analysis records as reviewed** (Step 7) and stop.
- If **relevant findings clearly point to specific improvements**: Continue to Step 4.

Use AskUserQuestion to show the user what you found and get confirmation before proceeding:

"I found {N} relevant findings that suggest the following improvements to the Nova orchestrator commands:
{bullet list of proposed changes with reasoning}

Should I proceed with generating these updates on a new branch?"

### Step 4: Read Current Commands

Read these files to understand what currently exists:
- `.claude/commands/nova/plan.md`
- `.claude/commands/nova/help.md`

### Step 5: Generate Updates

For each file, determine what specific sections should change. Focus on:

**In `plan.md` (the orchestrator engine):**
- Phase detection logic and artifact scanning
- Phase transition conditions
- Discovery phase assessment heuristics
- Skip behavior warnings and confirmations
- Progress display format
- Sub-skill routing instructions
- Rules section

**In `help.md` (user-facing documentation):**
- Tips section (add tips based on observed failure patterns)
- Workflow phases table (if phase logic changes)
- Example session (update if flow changes significantly)
- Any new in-session commands

**Do NOT change in `plan.md`:**
- The frontmatter (description, argument-hint, allowed-tools)
- The state file JSON schema structure
- The artifact file path conventions (specs/projects/{slug}/)
- The list of sub-skills being coordinated
- The fundamental four-phase structure (problem -> solution -> critique -> plan)

Apply the changes using Edit tool calls to make targeted, minimal modifications.

### Step 6: Create Branch and Open PR

Once the files are updated:

1. Create a new branch:
```bash
git checkout -b auto/nova-update-$(date +%Y%m%d-%H%M%S)
```

2. Stage only the changed command files:
```bash
git add .claude/commands/nova/plan.md .claude/commands/nova/help.md
```

3. Commit with a descriptive message summarizing what findings drove the changes.

4. Push and open a PR:
```bash
git push -u origin HEAD
gh pr create --title "Update nova orchestrator commands based on session analysis" --body "$(cat <<'EOF'
## Summary
Automated update to Nova orchestrator commands based on planning failure analysis findings.

### Changes
{describe what changed and why}

### Findings That Drove Changes
{list the relevant findings with their categories}

### What Was NOT Changed
{list any relevant findings that were considered but not acted on, and why}

---
Generated by `/nova:automatic_updater`
EOF
)"
```

5. Switch back to the original branch:
```bash
git checkout -
```

6. Tell the user: "PR opened: {PR_URL}. Please review the proposed changes to the Nova orchestrator commands."

### Step 7: Mark Findings as Reviewed

**This step runs regardless of outcome** — whether changes were made, findings were irrelevant, or findings were too minor. The point is to never re-process the same analysis records.

For each `analysis_id` collected in Step 1, update its metadata to include `"reviewed_by_nova_updater": true`:

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
        meta['reviewed_by_nova_updater'] = True
        cursor.execute('UPDATE analyses SET metadata = ? WHERE id = ?', (json.dumps(meta), aid))
print(f'Marked {len(analysis_ids)} analysis record(s) as reviewed.')
"
```

## Begin

Start by running Step 1 to load unreviewed findings from the database.
