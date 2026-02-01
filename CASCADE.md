# Planning Prompt Auto-Updater

## L1: Data Layer

### L2: Foundation
| Task ID | Task Name | What Changes | Depends On |
|---------|-----------|--------------|------------|
| F1 | SQLite Schema | Create db.py with sessions, messages, and analyses tables + connection helpers | - |
| F2 | JSONL Parser | Parse a single JSONL line, classify as human message vs tool result vs assistant vs queue-op | - |
| F3 | Message Filter | Given a parsed JSONL entry, return True only if it's a real human message (type=user, content is string, not tool_result) | F2 |

### L2: Ingestion
| Task ID | Task Name | What Changes | Depends On |
|---------|-----------|--------------|------------|
| I1 | Single File Ingest | Read one JSONL file, extract session metadata (session_id, branch, cwd), insert into sessions table | F1, F2, F3 |
| I2 | Message Ingest | For a single JSONL file, extract all human messages in order, insert into messages table with message_index | F1, F3, I1 |
| I3 | Batch Ingest | Accept a directory path, discover all .jsonl files, run I1+I2 for each, skip already-ingested sessions | I1, I2 |
| I4 | Ingest CLI | Wire up ingest.py with argparse: accepts file or directory path, prints summary of what was ingested | I3 |

## L1: Analysis

### L2: Claude API Integration
| Task ID | Task Name | What Changes | Depends On |
|---------|-----------|--------------|------------|
| A1 | API Client | Create a thin wrapper around Anthropic SDK — send messages, get response, handle errors | - |
| A2 | Analysis Prompt | Write the prompt template that takes a list of user messages and asks Claude to identify planning failures | - |
| A3 | Response Parser | Parse Claude's analysis response into structured data (failure_category, description, suggested_improvement) | A2 |

### L2: Session Analysis
| Task ID | Task Name | What Changes | Depends On |
|---------|-----------|--------------|------------|
| S1 | Single Session Analysis | Load messages for a session from DB, send to Claude via A1 with prompt A2, parse with A3, store in analyses table | F1, A1, A2, A3 |
| S2 | Batch Analysis | Find all unanalyzed sessions, run S1 for each | S1 |
| S3 | Analysis CLI | Wire up analyze.py with argparse: --session <id> or --all, requires ANTHROPIC_API_KEY env var | S1, S2 |

## L1: Prompt Update

### L2: Prompt Generation
| Task ID | Task Name | What Changes | Depends On |
|---------|-----------|--------------|------------|
| U1 | Load Current Prompt | Read the planning system prompt file from a given path | - |
| U2 | Aggregate Findings | Query all unaddressed analyses from DB, group by failure_category, deduplicate similar suggestions | F1 |
| U3 | Generate Prompt Diff | Send current prompt + aggregated findings to Claude API, ask for an updated prompt that addresses the failures | A1, U1, U2 |

### L2: PR Automation
| Task ID | Task Name | What Changes | Depends On |
|---------|-----------|--------------|------------|
| P1 | Write Updated Prompt | Save the generated prompt to a temp file or directly to the target path | U3 |
| P2 | Spawn Claude Code PR | Shell out to claude-code to create branch, commit the prompt change, and open a PR with analysis summary as description | P1 |
| P3 | Update CLI | Wire up update_prompt.py with argparse: --prompt-file <path>, orchestrates U1 through P2 | P1, P2 |
