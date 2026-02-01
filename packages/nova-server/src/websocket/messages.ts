/**
 * WebSocket message types for Nova voice interface
 *
 * Client -> Server messages and Server -> Client messages
 * following the protocol defined in specs/nova-voice-architecture.md
 */

// Session mode: problem-advisor or solution-architect
export type SessionMode = 'problem' | 'solution';

// Commands that clients can send
export type CommandType = '/progress' | '/export' | '/save' | '/load' | '/help' | '/eject';

// ============================================================
// Client -> Server Messages
// ============================================================

export interface StartSessionMessage {
  type: 'start_session';
  mode: SessionMode;
  model?: string;
}

export interface ResumeSessionMessage {
  type: 'resume_session';
  sessionId: string;
}

export interface UserMessageMessage {
  type: 'user_message';
  text: string;
}

export interface CommandMessage {
  type: 'command';
  cmd: CommandType;
  args?: string;
}

export type ClientMessage =
  | StartSessionMessage
  | ResumeSessionMessage
  | UserMessageMessage
  | CommandMessage;

// ============================================================
// Server -> Client Messages
// ============================================================

export interface SessionStartedMessage {
  type: 'session_started';
  sessionId: string;
  mode: SessionMode;
}

export interface AssistantChunkMessage {
  type: 'assistant_chunk';
  text: string;
}

export interface AssistantDoneMessage {
  type: 'assistant_done';
}

// Dimension state for progress updates
export interface DimensionInfo {
  id: string;
  coverage: 'not_started' | 'weak' | 'partial' | 'strong';
  evidence: string[];
}

export interface ProgressUpdateMessage {
  type: 'progress_update';
  dimensions: DimensionInfo[];
  currentFocus: string | null;
}

export interface ExportReadyMessage {
  type: 'export_ready';
  format: string;
  data: string;
}

export interface ErrorMessage {
  type: 'error';
  message: string;
  code?: string;
}

export interface SessionResumedMessage {
  type: 'session_resumed';
  sessionId: string;
  mode: SessionMode;
}

export type ServerMessage =
  | SessionStartedMessage
  | SessionResumedMessage
  | AssistantChunkMessage
  | AssistantDoneMessage
  | ProgressUpdateMessage
  | ExportReadyMessage
  | ErrorMessage;

// ============================================================
// Type Guards
// ============================================================

export function isClientMessage(msg: unknown): msg is ClientMessage {
  if (typeof msg !== 'object' || msg === null) return false;
  const m = msg as Record<string, unknown>;
  return (
    m.type === 'start_session' ||
    m.type === 'resume_session' ||
    m.type === 'user_message' ||
    m.type === 'command'
  );
}

export function isStartSessionMessage(msg: ClientMessage): msg is StartSessionMessage {
  return msg.type === 'start_session';
}

export function isResumeSessionMessage(msg: ClientMessage): msg is ResumeSessionMessage {
  return msg.type === 'resume_session';
}

export function isUserMessageMessage(msg: ClientMessage): msg is UserMessageMessage {
  return msg.type === 'user_message';
}

export function isCommandMessage(msg: ClientMessage): msg is CommandMessage {
  return msg.type === 'command';
}
