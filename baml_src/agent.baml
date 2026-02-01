// Enums for type safety
enum MessageRole {
  User
  Assistant
}

enum ToolName {
  AgentTool
}

enum AgentResponseType {
  Reply
  ToolCall
}

// Message structure for conversation history
class Message {
  role MessageRole
  content string
}

// Tool call structure with typed tool
class ToolCall {
  tool ToolName
  args string  // JSON string of arguments
}

// Agent response with discriminated union pattern
class AgentResponse {
  type AgentResponseType
  tool_call ToolCall?
  message string?
}

// Main agent loop function
function AgentLoop(
  messages: Message[],
  working_dir: string
) -> AgentResponse {
  client GPT4o

  prompt #"
    You are an AI coding agent helping developers accomplish tasks.

    Working directory: {{ working_dir }}

    Available tools:
    - AgentTool(message: str) - Proxy to claude CLI to execute arbitrary tasks
      Sends message to 'claude -p <message>' and returns output.
      Use this tool to delegate any task to claude CLI.

    RULES:
    1. Execute ONE tool at a time (no parallel execution)
    2. After using a tool, wait for the result before deciding next action
    3. When task is complete, use type="Reply" with your message
    4. Use AgentTool to delegate complex tasks to claude CLI

    Conversation history:
    {% for msg in messages %}
    {{ msg.role }}: {{ msg.content }}
    {% endfor %}

    What do you want to do next? Think step by step.

    Respond in this exact JSON format:
    {
      "type": "Reply" | "ToolCall",
      "tool_call": {
        "tool": "ToolName",
        "args": "{\"param\": \"value\"}"
      },
      "message": "your response to user (if type=Reply)"
    }

    Examples:
    - To execute a task: {"type": "ToolCall", "tool_call": {"tool": "AgentTool", "args": "{\"message\": \"List all Python files\"}"}}
    - To reply: {"type": "Reply", "message": "I've completed the task!"}
  "#
}
