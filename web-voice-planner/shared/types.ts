// WebSocket message types
export type WSMessageType =
  | 'audio_chunk'
  | 'text_input'
  | 'transcript_update'
  | 'ai_response'
  | 'ai_audio'
  | 'session_state'
  | 'error'
  | 'stop_speaking'
  | 'generate_spec'
  | 'spec_generated';

export interface WSMessage {
  type: WSMessageType;
  payload: unknown;
  timestamp: number;
}

// Session state
export interface SessionState {
  id: string;
  slug: string;
  startedAt: string;
  currentPhase: 'gathering' | 'edge_case_discovery' | 'validation' | 'complete';
  dimensions: Record<DimensionName, DimensionState>;
  conversationHistory: ConversationEntry[];
}

export type DimensionName =
  | 'solution_clarity'
  | 'user_value'
  | 'scope_boundaries'
  | 'success_criteria'
  | 'technical_constraints'
  | 'edge_cases';

export interface DimensionState {
  coverage: 'not_started' | 'weak' | 'partial' | 'strong';
  evidence: string[];
}

export interface ConversationEntry {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  audioUrl?: string;
}
