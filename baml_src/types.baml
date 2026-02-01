// Core types for Nova task orchestrator

// Task sizes for planning
enum TaskSize {
  XS @description("Extra Small: < 30 min, single file, clear spec")
  S @description("Small: 30 min - 2 hours, 1-2 files, straightforward")
  M @description("Medium: 2-8 hours, multiple files, some complexity")
  L @description("Large: 1-2 days, cross-cutting changes, significant effort")
  XL @description("Extra Large: 2+ days, needs decomposition")
}

// Task decomposition for planner
class SubtaskDefinition {
  id string @description("Unique identifier for this subtask (e.g., 'db-schema', 'api-endpoint'). Use kebab-case.")
  title string @description("Clear, actionable title")
  description string @description("Concrete requirements and acceptance criteria")
  type "task" | "bug" | "feature" @description("Type of work")
  priority int @description("Priority: 0=critical, 2=medium, 4=backlog")
  depends_on string[] @description("IDs of tasks this depends on (use the 'id' field, empty if no dependencies)")
}

// Planner output for sizing and decomposition
class PlannerDecision {
  size TaskSize @description("Estimated size of the task")
  should_split bool @description("Whether to decompose into subtasks")
  subtasks SubtaskDefinition[] @description("Child tasks if should_split=true (empty array otherwise)")
  reasoning string @description("Brief explanation of sizing and decomposition decision")
}

// Worker execution result
class WorkerResult {
  success bool @description("Whether the task was completed successfully")
  summary string @description("Brief description of what was done")
  output_files string[] @description("List of files created or modified")
  confidence float @description("Confidence level 0.0-1.0 in the solution quality")
  questions string[] @description("Unresolved questions or ambiguities encountered")
  error_message string? @description("Error details if success=false")
}

// Validation result
class ValidationResult {
  passed bool @description("Whether validation checks passed")
  message string @description("Summary of validation outcome")
  failures string[] @description("Specific test failures or issues found")
}

// Escalation decision
enum EscalationAction {
  FIX @description("Send to fixer LLM with additional context")
  HUMAN @description("Request human intervention")
  SKIP @description("Mark as blocked and move on")
}

class EscalationDecision {
  action EscalationAction @description("What to do with this blocked task")
  reason string @description("Why this action was chosen")
  fixer_prompt string? @description("Guidance for fixer LLM (only if action=FIX)")
  human_question string? @description("Question for human (only if action=HUMAN)")
}

// Telemetry data point
class TelemetryEntry {
  task_id string @description("ID of the task")
  attempt_num int @description("Attempt number (1-indexed)")
  model string @description("Model used (e.g., gpt-4o-mini)")
  tokens_used int @description("Total tokens consumed")
  duration_ms int @description("Execution time in milliseconds")
  cost_usd float @description("Estimated cost in USD")
  success bool @description("Whether this attempt succeeded")
  error_message string? @description("Error message if failed")
}
