---
description: "Update solution critic commands based on session analysis findings"
allowed-tools: ["Bash", "Read", "Write", "Edit", "Glob", "AskUserQuestion"]
---

# Solution Critic Automatic Updater

You are the final step in a closed feedback loop. Your job is to take planning failure analyses from `nova.db` and determine whether the solution-critic commands (`plan.md` and `help.md`) should be improved based on those findings.

## Important Principles

- **Conservative by default.** If the findings don't clearly warrant changes to the critique process, say so and stop. No changes is a valid outcome.
- **Relevance filtering.** The analysis pipeline identifies general planning failures across all Claude Code sessions. Many of these failures have nothing to do with the solution-critic process. Only act on findings that are directly relevant to improving how the critic identifies edge cases, failure modes, ambiguities, and risks.
- **Output is a PR, not a direct write.** Any changes must go on a new branch and be opened as a pull request for human review.

## Workflow

### Step 1: Load Unreviewed Analysis Findings

Only load findings that haven't already been processed by a previous run of this updater. The `analyses` table has a `metadata` JSON column — processed records get stamped with `"reviewed_by_solution_critic_updater": true`.

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
        if meta.get('reviewed_by_solution_critic_updater'):
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

Review each finding and determine if it's relevant to improving the solution-critic process. A finding is relevant if it suggests improvements to:

- **Edge case probe questions** — better questions for identifying edge cases, boundary conditions, or unusual inputs
- **Failure mode analysis** — improvements to how we surface errors, recovery paths, or silent failures
- **Ambiguity detection** — better prompts for finding vague terms, implicit assumptions, or undefined behavior
- **Dependency risk assessment** — improvements to identifying external dependencies that could fail
- **Scalability analysis** — better questions about performance, data growth, or concurrent usage
- **Security considerations** — improvements to surfacing security implications
- **Dimension coverage thresholds** — evidence that a threshold is too low or too high
- **Issue categorization** — improvements to how issues are prioritized (Critical/High/Medium/Low)
- **Critique document format** — improvements to the output structure

A finding is NOT relevant if it's about:
- Requirements gathering (that's solution-architect's job)
- Understanding WHAT to build (solution-architect)
- Implementation planning (that's create-plan's job)
- Code implementation details
- Anything about how to build rather than what could go wrong

Categorize each finding as `relevant` or `not_relevant` and explain why in one sentence.

### Step 3: Assess Whether Changes Are Warranted

After filtering, evaluate whether the relevant findings justify changes:

- If **zero relevant findings**: Tell the user "No findings are relevant to the solution-critic process. No changes needed." Then **mark all loaded analysis records as reviewed** (Step 7) and stop.
- If **relevant findings exist but are too vague or minor**: Tell the user what you found and why it doesn't warrant changes. Then **mark all loaded analysis records as reviewed** (Step 7) and stop.
- If **relevant findings clearly point to specific improvements**: Continue to Step 4.

Use AskUserQuestion to show the user what you found and get confirmation before proceeding:

"I found {N} relevant findings that suggest the following improvements to the solution-critic commands:
{bullet list of proposed changes with reasoning}

Should I proceed with generating these updates on a new branch?"

### Step 4: Read Current Commands

Read these files to understand what currently exists:
- `.claude/commands/solution-critic/plan.md`
- `.claude/commands/solution-critic/help.md`

### Step 5: Generate Updates

For each file, determine what specific sections should change. Focus on:

**In `plan.md` (the critique engine):**
- Dimension probe questions (add/refine questions based on findings)
- Focus areas under dimension definitions
- Phase analysis flow
- Rules section
- Good/bad examples for issue identification
- Sign-off check criteria
- Critique document format

**In `help.md` (user-facing documentation):**
- Tips section (add tips based on observed failure patterns)
- Dimension table (if thresholds change)
- Any new workflow guidance

**Do NOT change in `plan.md`:**
- The frontmatter (description, argument-hint, allowed-tools)
- The state file JSON schema structure
- The critique markdown template structure (keep the tables/sections)
- The session setup flow
- The commands list
- The coverage level definitions (not_started/weak/partial/strong)

Apply the changes using Edit tool calls to make targeted, minimal modifications.

### Step 6: Create Branch and Open PR

Once the files are updated:

1. Create a new branch:
```bash
git checkout -b auto/solution-critic-update-$(date +%Y%m%d-%H%M%S)
```

2. Stage only the changed command files:
```bash
git add .claude/commands/solution-critic/plan.md .claude/commands/solution-critic/help.md
```

3. Commit with a descriptive message summarizing what findings drove the changes.

4. Push and open a PR:
```bash
git push -u origin HEAD
gh pr create --title "Update solution-critic commands based on session analysis" --body "$(cat <<'EOF'
## Summary
Automated update to solution-critic commands based on planning failure analysis findings.

### Changes
{describe what changed and why}

### Findings That Drove Changes
{list the relevant findings with their categories}

### What Was NOT Changed
{list any relevant findings that were considered but not acted on, and why}

---
Generated by `/solution-critic:automatic_updater`
EOF
)"
```

5. Switch back to the original branch:
```bash
git checkout -
```

6. Tell the user: "PR opened: {PR_URL}. Please review the proposed changes to the solution-critic commands."

### Step 7: Mark Findings as Reviewed

**This step runs regardless of outcome** — whether changes were made, findings were irrelevant, or findings were too minor. The point is to never re-process the same analysis records.

For each `analysis_id` collected in Step 1, update its metadata to include `"reviewed_by_solution_critic_updater": true`:

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
        meta['reviewed_by_solution_critic_updater'] = True
        cursor.execute('UPDATE analyses SET metadata = ? WHERE id = ?', (json.dumps(meta), aid))
print(f'Marked {len(analysis_ids)} analysis record(s) as reviewed.')
"
```

## Begin

Start by running Step 1 to load unreviewed findings from the database.
