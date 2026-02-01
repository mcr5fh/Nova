import type { WebSocket } from 'ws';
import type { WSMessage } from '../../shared/types';

/**
 * Custom error class for API-related errors that provides additional context
 * about whether the error is retryable and what fallback mode might be available.
 */
export class APIError extends Error {
  constructor(
    message: string,
    public code: string,
    public retryable: boolean = false,
    public fallbackMode?: 'text-only' | 'text-input'
  ) {
    super(message);
    this.name = 'APIError';
  }
}

/**
 * Wraps an async function with retry logic using exponential backoff.
 *
 * @param fn - The async function to retry
 * @param maxRetries - Maximum number of retry attempts (default: 3)
 * @param backoffMs - Initial backoff delay in milliseconds (default: 1000)
 * @returns The result of the function if successful
 * @throws The last error encountered if all retries fail
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  backoffMs: number = 1000
): Promise<T> {
  let lastError: Error | null = null;

  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      // Don't retry non-retryable errors
      if (error instanceof APIError && !error.retryable) {
        throw error;
      }

      // Don't wait after the last attempt
      if (i < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, backoffMs * Math.pow(2, i)));
      }
    }
  }

  throw lastError;
}

/**
 * Error codes for different failure scenarios
 */
export const ErrorCodes = {
  // Connection errors
  WEBSOCKET_ERROR: 'WEBSOCKET_ERROR',

  // API errors
  WHISPER_ERROR: 'WHISPER_ERROR',
  TTS_ERROR: 'TTS_ERROR',
  CLAUDE_ERROR: 'CLAUDE_ERROR',

  // Session errors
  SESSION_NOT_FOUND: 'SESSION_NOT_FOUND',
  SESSION_LOCKED: 'SESSION_LOCKED',
  NO_ACTIVE_SESSION: 'NO_ACTIVE_SESSION',

  // Storage errors
  SPEC_SAVE_ERROR: 'SPEC_SAVE_ERROR',
  SESSION_PERSIST_ERROR: 'SESSION_PERSIST_ERROR',

  // Client errors
  INVALID_MESSAGE: 'INVALID_MESSAGE',
  UNKNOWN: 'UNKNOWN',
} as const;

export type ErrorCode = typeof ErrorCodes[keyof typeof ErrorCodes];

/**
 * User-friendly error messages for each error code
 */
export const ErrorMessages: Record<ErrorCode, string> = {
  WEBSOCKET_ERROR: 'Connection error. Attempting to reconnect...',
  WHISPER_ERROR: 'Failed to transcribe audio. Please try again or use text input.',
  TTS_ERROR: 'Voice response unavailable. Text response shown below.',
  CLAUDE_ERROR: 'Failed to get AI response. Please try again.',
  SESSION_NOT_FOUND: 'Session not found. Please start a new session.',
  SESSION_LOCKED: 'This session is active in another tab. Please close other tabs or start a new session.',
  NO_ACTIVE_SESSION: 'No active session. Please start a session first.',
  SPEC_SAVE_ERROR: 'Failed to save specification. Retrying...',
  SESSION_PERSIST_ERROR: 'Failed to save session state.',
  INVALID_MESSAGE: 'Invalid message format.',
  UNKNOWN: 'An unexpected error occurred.',
};

/**
 * Sends a structured error message to the client via WebSocket
 *
 * @param ws - The WebSocket connection to send the error to
 * @param code - The error code
 * @param customMessage - Optional custom message to override the default
 * @param fallbackMode - Optional fallback mode hint for the client
 */
export function sendErrorToClient(
  ws: WebSocket,
  code: ErrorCode,
  customMessage?: string,
  fallbackMode?: 'text-only' | 'text-input'
): void {
  const message: WSMessage = {
    type: 'error',
    payload: {
      message: customMessage || ErrorMessages[code],
      code,
      fallbackMode,
    },
    timestamp: Date.now(),
  };

  if (ws.readyState === ws.OPEN) {
    ws.send(JSON.stringify(message));
  }
}

/**
 * Creates an APIError from a caught error, attempting to classify it
 *
 * @param error - The caught error
 * @param defaultCode - The default error code if classification fails
 * @returns An APIError instance
 */
export function classifyError(error: unknown, defaultCode: ErrorCode): APIError {
  if (error instanceof APIError) {
    return error;
  }

  const err = error as Error;
  const message = err?.message || 'Unknown error';

  // Check for common error patterns
  if (message.includes('ECONNREFUSED') || message.includes('network')) {
    return new APIError(message, ErrorCodes.WEBSOCKET_ERROR, true);
  }

  if (message.includes('rate limit') || message.includes('429')) {
    return new APIError(message, defaultCode, true);
  }

  if (message.includes('timeout') || message.includes('ETIMEDOUT')) {
    return new APIError(message, defaultCode, true);
  }

  // Default to the provided code
  return new APIError(message, defaultCode, false);
}
