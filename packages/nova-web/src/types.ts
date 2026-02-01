// Voice state machine states
export type VoiceState = 'IDLE' | 'LISTENING' | 'PROCESSING' | 'SPEAKING';

// Session modes
export type SessionMode = 'problem' | 'solution';

// Message types
export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

// Dimension progress
export interface DimensionState {
  name: string;
  status: 'not_started' | 'in_progress' | 'complete';
  coverage: number;
  currentQuestion?: string;
}

// WebSocket message types (Client -> Server)
export type ClientMessage =
  | { type: 'start_session'; mode: SessionMode; model?: string }
  | { type: 'resume_session'; sessionId: string }
  | { type: 'user_message'; text: string }
  | { type: 'command'; cmd: '/progress' | '/export' | '/save'; args?: string };

// WebSocket message types (Server -> Client)
export type ServerMessage =
  | { type: 'session_started'; sessionId: string }
  | { type: 'assistant_chunk'; text: string }
  | { type: 'assistant_done' }
  | { type: 'progress_update'; dimensions: DimensionState[] }
  | { type: 'export_ready'; format: string; data: string }
  | { type: 'error'; message: string };

// TTS Service interface
export interface TTSService {
  speak(text: string): Promise<void>;
  stop(): void;
  isSpeaking(): boolean;
}

// Speech recognition types
export interface SpeechRecognitionResult {
  transcript: string;
  isFinal: boolean;
  confidence: number;
}
