"""
Prompt templates for Claude API interactions.

This module contains prompt templates used for analyzing sessions and generating insights.
"""


def get_planning_failure_analysis_prompt(user_messages: list[str]) -> str:
    """
    Generate a prompt that asks Claude to analyze user messages and identify planning failures.

    Args:
        user_messages: List of user message strings from a session

    Returns:
        str: Formatted prompt for Claude API
    """

    # Format messages as a numbered list
    formatted_messages = "\n".join(
        f"{i+1}. {msg}" for i, msg in enumerate(user_messages)
    )

    prompt = f"""You are analyzing a conversation session between a user and Claude Code, an AI coding assistant.

Below is a chronological list of all user messages from this session:

<user_messages>
{formatted_messages}
</user_messages>

Your task is to identify planning failures - situations where Claude Code should have entered plan mode or used better planning strategies but failed to do so.

## What constitutes a planning failure?

A planning failure occurs when:
1. The user requested a feature or change that involves multiple files or architectural decisions
2. The task was non-trivial and would benefit from upfront planning
3. The user's request was ambiguous or could be solved in multiple valid ways
4. Claude Code should have asked clarifying questions before implementation
5. The task required coordination across different parts of the codebase
6. The user had to course-correct or provide additional context mid-implementation

## What is NOT a planning failure?

- Simple, single-file changes or bug fixes
- Tasks where the user provided very specific, detailed instructions
- Straightforward refactoring with clear requirements
- Research or exploratory tasks (just reading/analyzing code)
- Adding simple logging, comments, or trivial changes

## Your analysis should identify:

For each planning failure you identify, provide:

1. **failure_category**: One of:
   - "missing_plan_mode": Should have entered plan mode but didn't
   - "insufficient_clarification": Should have asked clarifying questions first
   - "premature_implementation": Started coding before understanding requirements
   - "missing_architecture_discussion": Should have discussed approach/tradeoffs
   - "poor_task_breakdown": Should have broken task into clearer subtasks

2. **triggering_message_number**: The message number (from the list above) that triggered this failure

3. **description**: A brief description of what went wrong (2-3 sentences)

4. **suggested_improvement**: Specific suggestion for how the system prompt should be updated to prevent this failure (1-2 sentences)

## Output format:

Return your analysis as a JSON array of findings. If no planning failures are found, return an empty array.

Example:
```json
[
  {{
    "failure_category": "missing_plan_mode",
    "triggering_message_number": 3,
    "description": "User requested adding authentication to the app, which is a multi-file architectural change. Claude should have entered plan mode to design the auth system before implementing.",
    "suggested_improvement": "System prompt should emphasize entering plan mode for authentication/authorization features as they always involve architectural decisions."
  }},
  {{
    "failure_category": "insufficient_clarification",
    "triggering_message_number": 7,
    "description": "User asked to 'optimize the API' without specifying what metrics matter (latency, throughput, memory). Claude started making changes without clarifying optimization goals.",
    "suggested_improvement": "When users request optimization, the prompt should require asking what specific metrics to optimize for before proceeding."
  }}
]
```

Analyze the conversation and return your findings as JSON:"""

    return prompt


def get_prompt_update_generation_prompt(
    current_prompt: str,
    aggregated_findings: list[dict]
) -> str:
    """
    Generate a prompt asking Claude to update the planning system prompt based on analysis findings.

    Args:
        current_prompt: The current planning system prompt
        aggregated_findings: List of planning failure findings grouped and deduplicated

    Returns:
        str: Formatted prompt for Claude API
    """

    # Format findings by category
    findings_by_category = {}
    for finding in aggregated_findings:
        category = finding.get("failure_category", "unknown")
        if category not in findings_by_category:
            findings_by_category[category] = []
        findings_by_category[category].append(finding)

    formatted_findings = []
    for category, findings in findings_by_category.items():
        formatted_findings.append(f"\n### {category.replace('_', ' ').title()}")
        formatted_findings.append(f"Occurrences: {len(findings)}")
        formatted_findings.append("\nSuggested improvements:")
        for f in findings:
            formatted_findings.append(f"- {f.get('suggested_improvement', 'N/A')}")

    findings_text = "\n".join(formatted_findings)

    prompt = f"""You are helping improve an AI coding assistant's planning behavior.

Below is the current system prompt that controls when and how the assistant enters "plan mode":

<current_prompt>
{current_prompt}
</current_prompt>

Analysis of recent sessions has identified the following planning failures:

<planning_failures>
{findings_text}
</planning_failures>

Your task is to update the system prompt to address these failures while maintaining its current structure and intent.

## Guidelines:

1. **Preserve existing good behavior**: Don't remove examples or guidelines that are working well
2. **Be specific**: Add concrete examples or rules that would prevent the identified failures
3. **Maintain clarity**: Keep the prompt readable and well-organized
4. **Avoid over-correction**: Don't make the rules so strict that simple tasks trigger plan mode unnecessarily
5. **Use examples**: Where appropriate, add examples that illustrate the new guidance

## Output format:

Return the complete updated system prompt. Do not include any preamble or explanation - just return the updated prompt text itself.
"""

    return prompt
