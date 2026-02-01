---
description: "Ingest a JSONL session file, analyze it for planning failures, and update planning commands if warranted"
argument-hint: "PATH_TO_JSONL"
allowed-tools: ["Bash", "Read", "Write", "Edit", "Glob", "AskUserQuestion"]
---

# Full Loop: Ingest → Analyze → Update

This command runs the entire feedback loop end-to-end. You point it at a Claude Code session JSONL file (or directory of them), and it ingests, analyzes, and proposes improvements to the planning commands (solution-architect, nova, and solution-critic) if the analysis warrants it.

## Phase 1: Ingest and Analyze

The path from arguments is: `$ARGUMENTS`

If no path was provided, use AskUserQuestion to ask for the path to a JSONL file or directory.

### Step 1: Preflight Checks

Verify `ANTHROPIC_API_KEY` is set:

```bash
python3 -c "import os; key = os.getenv('ANTHROPIC_API_KEY'); print('OK' if key else 'MISSING')"
```

If `MISSING`, tell the user: "ANTHROPIC_API_KEY is not set. Run `export ANTHROPIC_API_KEY='your-key'` and try again." Then stop.

Verify the path exists:

```bash
test -e "$PATH" && echo "OK" || echo "NOT_FOUND"
```

If `NOT_FOUND`, tell the user the path doesn't exist and stop.

### Step 2: Initialize Database

```bash
python3 db.py
```

This is idempotent (CREATE TABLE IF NOT EXISTS). Safe to run every time.

### Step 3: Import Session Metadata

```bash
python3 program_nova/session_importer.py {path}
```

### Step 4: Import Messages

If the path is a single JSONL file:

```bash
python3 program_nova/message_importer.py {path}
```

If the path is a directory, import each JSONL file:

```bash
for file in {path}/*.jsonl; do python3 program_nova/message_importer.py "$file"; done
```

### Step 5: Analyze Sessions

```bash
python3 analyze_session.py --all
```

Report the output to the user so they can see how many sessions were analyzed and how many failures were found.

---

## Phase 2: Update Planning Commands

Now transition into the updater logic. This phase applies the same analysis to all three planning skills: **solution-architect**, **nova**, and **solution-critic**. Each skill has its own relevance criteria and updatable sections.

### Step 6: Load Unreviewed Findings

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

If no unreviewed findings, tell the user: "Analysis complete but no new findings to review. The session may not have had any planning failures, or all findings were already processed." Then stop.

Save the `analysis_ids` list for the final step.

### Step 7: Filter for Relevance

Review each finding and categorize it by which skill(s) it's relevant to:

#### Solution-Architect Relevance
A finding is relevant to **solution-architect** if it suggests improvements to the specification interview: probe questions, dimension thresholds, good/bad examples, phase guidance, rules, edge case patterns, or sign-off criteria.

#### Nova Relevance
A finding is relevant to **nova** if it suggests improvements to the orchestration workflow: phase detection, artifact scanning, routing between sub-skills, progress tracking, skip behavior, or phase transition guidance.

#### Solution-Critic Relevance
A finding is relevant to **solution-critic** if it suggests improvements to the critique process: dimension definitions, probe questions, issue categorization, risk assessment, confidence scoring, or critique output format.

#### Not Relevant
A finding is **not relevant** if it's about code implementation, plan mode for code changes, task breakdown for implementation, or anything about HOW to build rather than WHAT to build.

### Step 8: Assess Whether Changes Are Warranted

For each skill with relevant findings:

- **Zero relevant findings for a skill** → Note this and move to the next skill.
- **Relevant but too vague/minor** → Note what was found and why it doesn't warrant changes.
- **Clear, actionable improvements** → Include in the proposed changes.

If **no skill has actionable improvements**: Tell the user and mark findings as reviewed (Step 12). Stop.

If **any skill has actionable improvements**: Use AskUserQuestion to show the user what you propose for each skill and get confirmation. Then continue.

### Step 9: Read Current Commands

Read the relevant files for each skill that has actionable improvements:

**Solution-Architect:**
- `.claude/commands/solution-architect/plan.md`
- `.claude/commands/solution-architect/help.md`

**Nova:**
- `.claude/commands/nova/plan.md`
- `.claude/commands/nova/help.md`

**Solution-Critic:**
- `.claude/commands/solution-critic/plan.md`
- `.claude/commands/solution-critic/help.md`

### Step 10: Generate Updates

Apply targeted edits using Edit tool calls. Focus on the appropriate sections for each skill:

#### Solution-Architect

**In `plan.md`:** Probe questions, good/bad examples, phase guidance, rules, edge case prompts, sign-off criteria.

**In `help.md`:** Tips section, dimension table (if thresholds change), workflow guidance.

**Do NOT change in `plan.md`:** Frontmatter, state file schema, output spec template, session setup flow, commands list, coverage level definitions.

#### Nova

**In `plan.md`:** Phase transition logic, artifact detection patterns, sub-skill routing guidance, skip behavior warnings, progress display format.

**In `help.md`:** Tips section, phase table, workflow guidance, example session.

**Do NOT change in `plan.md`:** Frontmatter, state file JSON schema, project directory structure, commands list.

#### Solution-Critic

**In `plan.md`:** Dimension definitions, probe questions, issue categorization guidance, risk assessment criteria, confidence scoring, critique output format.

**In `help.md`:** Tips section, dimension table (if thresholds change), workflow guidance.

**Do NOT change in `plan.md`:** Frontmatter, state file JSON schema, coverage level definitions, commands list.

### Step 11: Create Branch and Open PR

1. Create branch: `git checkout -b auto/planning-commands-update-$(date +%Y%m%d-%H%M%S)`
2. Stage all changed command files:
```bash
git add .claude/commands/solution-architect/plan.md .claude/commands/solution-architect/help.md \
        .claude/commands/nova/plan.md .claude/commands/nova/help.md \
        .claude/commands/solution-critic/plan.md .claude/commands/solution-critic/help.md
```
   (Only add files that were actually modified)
3. Commit with a message summarizing what findings drove the changes and which skills were updated.
4. Push and open PR with a body that describes changes per skill, findings, and what was not changed.
5. Switch back: `git checkout -`
6. Report the PR URL to the user.

### Step 12: Mark Findings as Reviewed

**Runs on every exit path** — whether a PR was opened, findings were irrelevant, or nothing changed.

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

Start with Step 1: preflight checks.
