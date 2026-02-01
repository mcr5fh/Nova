/**
 * TypeScript types for Agent Chat WebSocket API
 * Based on AGENT_CHAT_WS_API.md specification
 */

// ============================================================================
// Client -> Server Messages
// ============================================================================

/**
 * Chat request message sent from client to server
 */
export interface ChatRequest {
  type: "chat";
  message: string;
  session_id?: string;
}

// ============================================================================
// Server -> Client Events
// ============================================================================

/**
 * Echo of the user's message (broadcast after the server accepts a chat)
 */
export interface UserMessageEvent {
  type: "user_message";
  message: string;
}

/**
 * Agent response content
 */
export interface AgentMessageEvent {
  type: "agent_message";
  message: string;
}

/**
 * Agent initiated tool execution
 */
export interface ToolCallEvent {
  type: "tool_call";
  tool_name: string;
  tool_args: string; // JSON-encoded string
}

/**
 * Tool execution result
 */
export interface ToolResultEvent {
  type: "tool_result";
  tool_name: string;
  result: string;
  success: boolean;
}

/**
 * Agent reasoning/debug stream
 */
export interface AgentThinkingEvent {
  type: "agent_thinking";
  reasoning: string;
}

/**
 * Server-side error or validation error
 */
export interface ErrorEvent {
  type: "error";
  error: string;
}

/**
 * Diagram update event with Mermaid diagram string
 */
export interface DiagramUpdateEvent {
  type: "diagram_update";
  diagram: string;
}

/**
 * Diagram rendering error
 */
export interface DiagramErrorEvent {
  type: "diagram_error";
  error: string;
}

/**
 * Union type of all possible server-to-client events
 */
export type ServerEvent =
  | UserMessageEvent
  | AgentMessageEvent
  | ToolCallEvent
  | ToolResultEvent
  | AgentThinkingEvent
  | ErrorEvent
  | DiagramUpdateEvent
  | DiagramErrorEvent;

/**
 * Union type of all possible client-to-server messages
 */
export type ClientMessage = ChatRequest;

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Type guard to check if an event is a UserMessageEvent
 */
export function isUserMessageEvent(event: ServerEvent): event is UserMessageEvent {
  return event.type === "user_message";
}

/**
 * Type guard to check if an event is an AgentMessageEvent
 */
export function isAgentMessageEvent(event: ServerEvent): event is AgentMessageEvent {
  return event.type === "agent_message";
}

/**
 * Type guard to check if an event is a ToolCallEvent
 */
export function isToolCallEvent(event: ServerEvent): event is ToolCallEvent {
  return event.type === "tool_call";
}

/**
 * Type guard to check if an event is a ToolResultEvent
 */
export function isToolResultEvent(event: ServerEvent): event is ToolResultEvent {
  return event.type === "tool_result";
}

/**
 * Type guard to check if an event is an AgentThinkingEvent
 */
export function isAgentThinkingEvent(event: ServerEvent): event is AgentThinkingEvent {
  return event.type === "agent_thinking";
}

/**
 * Type guard to check if an event is an ErrorEvent
 */
export function isErrorEvent(event: ServerEvent): event is ErrorEvent {
  return event.type === "error";
}

/**
 * Type guard to check if an event is a DiagramUpdateEvent
 */
export function isDiagramUpdateEvent(event: ServerEvent): event is DiagramUpdateEvent {
  return event.type === "diagram_update";
}

/**
 * Type guard to check if an event is a DiagramErrorEvent
 */
export function isDiagramErrorEvent(event: ServerEvent): event is DiagramErrorEvent {
  return event.type === "diagram_error";
}
