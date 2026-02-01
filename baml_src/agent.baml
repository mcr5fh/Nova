// Enums for type safety
enum MessageRole {
  User 
  Assistant
}

enum ToolName {
  AgentTool
}

enum AgentResponseType {
  Done
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

class AgentToolCall{
  type "AgentToolCall"
  args string
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
    3. When task is complete, use type="Done" with your message
    4. Use AgentTool to delegate complex tasks to claude CLI


    What do you want to do next? Think step by step.


    {{ ctx.output_format(prefix="Answer with the following format (execute ONE tool at a time):\n") }}

    {% for message in messages %}
    {{ message.role }}
    {{ message.content }}
    {% endfor %}
  "#

}
