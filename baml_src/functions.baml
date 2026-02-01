// Nova Orchestrator BAML Functions

// Planner: Decides task size and whether to decompose
function PlanTask(
  task_title: string,
  task_description: string,
  context: string
) -> PlannerDecision {
  client ResilientPlanner
  prompt #"
    {{ _.role("system") }}
    You are an expert task planner for software engineering work.
    Your job is to estimate the size and complexity of tasks and decide whether they should be decomposed into smaller subtasks.

    Size guidelines:
    - XS: < 30 min, single file, clear and specific
    - S: 30 min - 2 hours, 1-2 files, straightforward implementation
    - M: 2-8 hours, multiple files, moderate complexity
    - L: 1-2 days, cross-cutting changes, significant effort
    - XL: 2+ days, requires decomposition into smaller tasks

    Decomposition criteria:
    - If size > S, consider splitting
    - If task has multiple independent concerns, split
    - If requirements are ambiguous, split into research + implementation
    - Keep subtasks concrete and testable

    {{ _.role("user") }}
    Task Title: {{ task_title }}

    Description:
    {{ task_description }}

    Additional Context:
    {{ context }}

    Analyze this task and provide:
    1. Size estimate (XS/S/M/L/XL)
    2. Whether to split into subtasks
    3. If splitting, define concrete subtasks with clear acceptance criteria
    4. Brief reasoning for your decision

    {{ ctx.output_format }}
  "#
}

// Worker: Executes a leaf task
function ExecuteTask(
  task_title: string,
  task_description: string,
  context: string,
  attempt_num: int
) -> WorkerResult {
  client GPT4Mini
  prompt #"
    {{ _.role("system") }}
    You are a focused software engineering worker executing a single, well-defined task.
    Work within the scope provided and report what you accomplished.

    Guidelines:
    - Focus on the specific task at hand
    - Make minimal, targeted changes
    - Run tests to verify your work
    - Report any blockers or ambiguities
    - Be honest about your confidence level

    {{ _.role("user") }}
    Task: {{ task_title }}

    Requirements:
    {{ task_description }}

    Context:
    {{ context }}

    This is attempt {{ attempt_num }}.

    Execute this task and report:
    1. Whether you succeeded
    2. What files you modified
    3. A brief summary of what you did
    4. Your confidence level (0.0-1.0)
    5. Any unresolved questions or blockers

    {{ ctx.output_format }}
  "#
}

// Validator: Checks if task output meets requirements
function ValidateTask(
  task_title: string,
  task_description: string,
  worker_summary: string,
  test_output: string
) -> ValidationResult {
  client GPT4
  prompt #"
    {{ _.role("system") }}
    You are a code reviewer validating task completion.
    Check whether the implementation meets requirements and quality standards.

    {{ _.role("user") }}
    Task: {{ task_title }}

    Requirements:
    {{ task_description }}

    Worker's Summary:
    {{ worker_summary }}

    Test Output:
    {{ test_output }}

    Validate this work and report:
    1. Whether validation passed
    2. Summary of your assessment
    3. Specific failures or concerns (if any)

    {{ ctx.output_format }}
  "#
}

// Escalation Router: Decides how to handle blocked tasks
function RouteEscalation(
  task_title: string,
  task_description: string,
  failure_history: string,
  last_error: string
) -> EscalationDecision {
  client GPT4
  prompt #"
    {{ _.role("system") }}
    You are an escalation router deciding how to handle blocked tasks.

    Options:
    - FIX: Task can be fixed with better guidance or context (send to fixer LLM)
    - HUMAN: Task needs human clarification or decision
    - SKIP: Task is blocked by external factors, mark as blocked

    {{ _.role("user") }}
    Task: {{ task_title }}

    Requirements:
    {{ task_description }}

    Failure History:
    {{ failure_history }}

    Latest Error:
    {{ last_error }}

    Decide the best course of action:
    1. Choose an action (FIX, HUMAN, or SKIP)
    2. Explain why
    3. If FIX: provide specific guidance for the fixer
    4. If HUMAN: formulate a clear question

    {{ ctx.output_format }}
  "#
}

// Fixer: Attempts to unblock a failed task with additional guidance
function FixTask(
  task_title: string,
  task_description: string,
  previous_attempt_summary: string,
  fixer_guidance: string
) -> WorkerResult {
  client GPT4
  prompt #"
    {{ _.role("system") }}
    You are an expert fixer helping to unblock a failed task.
    Use the guidance provided to address the issue and complete the task.

    {{ _.role("user") }}
    Task: {{ task_title }}

    Requirements:
    {{ task_description }}

    Previous Attempt:
    {{ previous_attempt_summary }}

    Guidance:
    {{ fixer_guidance }}

    Apply the guidance and complete the task. Report:
    1. Whether you succeeded
    2. What files you modified
    3. What you did to address the issue
    4. Your confidence level
    5. Any remaining questions

    {{ ctx.output_format }}
  "#
}
