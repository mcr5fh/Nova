import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  withRetry,
  APIError,
  ErrorCodes,
  ErrorMessages,
  classifyError,
  sendErrorToClient,
} from './error-handler';

describe('error-handler', () => {
  describe('APIError', () => {
    it('creates error with code and retryable flag', () => {
      const error = new APIError('Test error', ErrorCodes.CLAUDE_ERROR, true);

      expect(error.message).toBe('Test error');
      expect(error.code).toBe(ErrorCodes.CLAUDE_ERROR);
      expect(error.retryable).toBe(true);
      expect(error.name).toBe('APIError');
    });

    it('creates error with fallback mode', () => {
      const error = new APIError(
        'Voice failed',
        ErrorCodes.TTS_ERROR,
        false,
        'text-only'
      );

      expect(error.fallbackMode).toBe('text-only');
    });

    it('defaults to non-retryable', () => {
      const error = new APIError('Test', ErrorCodes.UNKNOWN);

      expect(error.retryable).toBe(false);
    });
  });

  describe('withRetry', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    it('returns result on first success', async () => {
      const fn = vi.fn().mockResolvedValue('success');

      const result = await withRetry(fn);

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('retries on failure and succeeds', async () => {
      const fn = vi.fn()
        .mockRejectedValueOnce(new Error('fail'))
        .mockResolvedValue('success');

      const promise = withRetry(fn, 3, 100);

      // Fast-forward through the backoff
      await vi.advanceTimersByTimeAsync(100);

      const result = await promise;

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('uses exponential backoff', async () => {
      const fn = vi.fn()
        .mockRejectedValueOnce(new Error('fail 1'))
        .mockRejectedValueOnce(new Error('fail 2'))
        .mockResolvedValue('success');

      const promise = withRetry(fn, 3, 100);

      // First retry: 100ms
      await vi.advanceTimersByTimeAsync(100);
      expect(fn).toHaveBeenCalledTimes(2);

      // Second retry: 200ms (100 * 2^1)
      await vi.advanceTimersByTimeAsync(200);
      expect(fn).toHaveBeenCalledTimes(3);

      const result = await promise;
      expect(result).toBe('success');
    });

    it('throws non-retryable APIError immediately', async () => {
      const apiError = new APIError('Auth failed', ErrorCodes.SESSION_NOT_FOUND, false);
      const fn = vi.fn().mockRejectedValue(apiError);

      await expect(withRetry(fn, 3, 100)).rejects.toThrow('Auth failed');
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('retries retryable APIError', async () => {
      const retryableError = new APIError('Rate limited', ErrorCodes.CLAUDE_ERROR, true);
      const fn = vi.fn()
        .mockRejectedValueOnce(retryableError)
        .mockResolvedValue('success');

      const promise = withRetry(fn, 3, 100);

      await vi.advanceTimersByTimeAsync(100);

      const result = await promise;
      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('throws last error after all retries fail', async () => {
      vi.useRealTimers(); // Use real timers for this test to avoid unhandled rejection

      const fn = vi.fn().mockRejectedValue(new Error('persistent failure'));

      // Use short backoff for test
      await expect(withRetry(fn, 3, 10)).rejects.toThrow('persistent failure');
      expect(fn).toHaveBeenCalledTimes(3);
    });
  });

  describe('classifyError', () => {
    it('returns existing APIError unchanged', () => {
      const original = new APIError('Test', ErrorCodes.CLAUDE_ERROR, true);

      const result = classifyError(original, ErrorCodes.UNKNOWN);

      expect(result).toBe(original);
    });

    it('classifies ECONNREFUSED as retryable WebSocket error', () => {
      const error = new Error('ECONNREFUSED');

      const result = classifyError(error, ErrorCodes.UNKNOWN);

      expect(result.code).toBe(ErrorCodes.WEBSOCKET_ERROR);
      expect(result.retryable).toBe(true);
    });

    it('classifies network errors as retryable', () => {
      const error = new Error('network error');

      const result = classifyError(error, ErrorCodes.CLAUDE_ERROR);

      expect(result.code).toBe(ErrorCodes.WEBSOCKET_ERROR);
      expect(result.retryable).toBe(true);
    });

    it('classifies rate limit errors as retryable', () => {
      const error = new Error('rate limit exceeded');

      const result = classifyError(error, ErrorCodes.CLAUDE_ERROR);

      expect(result.code).toBe(ErrorCodes.CLAUDE_ERROR);
      expect(result.retryable).toBe(true);
    });

    it('classifies 429 errors as retryable', () => {
      const error = new Error('Request failed with status 429');

      const result = classifyError(error, ErrorCodes.WHISPER_ERROR);

      expect(result.code).toBe(ErrorCodes.WHISPER_ERROR);
      expect(result.retryable).toBe(true);
    });

    it('classifies timeout errors as retryable', () => {
      const error = new Error('ETIMEDOUT');

      const result = classifyError(error, ErrorCodes.TTS_ERROR);

      expect(result.code).toBe(ErrorCodes.TTS_ERROR);
      expect(result.retryable).toBe(true);
    });

    it('uses default code for unrecognized errors', () => {
      const error = new Error('Something went wrong');

      const result = classifyError(error, ErrorCodes.UNKNOWN);

      expect(result.code).toBe(ErrorCodes.UNKNOWN);
      expect(result.retryable).toBe(false);
    });

    it('handles null/undefined errors', () => {
      const result = classifyError(null, ErrorCodes.UNKNOWN);

      expect(result.code).toBe(ErrorCodes.UNKNOWN);
      expect(result.message).toBe('Unknown error');
    });
  });

  describe('ErrorMessages', () => {
    it('has messages for all error codes', () => {
      for (const code of Object.values(ErrorCodes)) {
        expect(ErrorMessages[code]).toBeDefined();
        expect(typeof ErrorMessages[code]).toBe('string');
      }
    });
  });

  describe('sendErrorToClient', () => {
    it('sends error message via WebSocket', () => {
      const mockWs = {
        readyState: 1, // OPEN
        OPEN: 1,
        send: vi.fn(),
      };

      sendErrorToClient(mockWs as any, ErrorCodes.CLAUDE_ERROR);

      expect(mockWs.send).toHaveBeenCalledTimes(1);
      const sent = JSON.parse(mockWs.send.mock.calls[0][0]);
      expect(sent.type).toBe('error');
      expect(sent.payload.code).toBe(ErrorCodes.CLAUDE_ERROR);
      expect(sent.payload.message).toBe(ErrorMessages.CLAUDE_ERROR);
    });

    it('uses custom message when provided', () => {
      const mockWs = {
        readyState: 1,
        OPEN: 1,
        send: vi.fn(),
      };

      sendErrorToClient(mockWs as any, ErrorCodes.UNKNOWN, 'Custom error');

      const sent = JSON.parse(mockWs.send.mock.calls[0][0]);
      expect(sent.payload.message).toBe('Custom error');
    });

    it('includes fallback mode when provided', () => {
      const mockWs = {
        readyState: 1,
        OPEN: 1,
        send: vi.fn(),
      };

      sendErrorToClient(mockWs as any, ErrorCodes.TTS_ERROR, undefined, 'text-only');

      const sent = JSON.parse(mockWs.send.mock.calls[0][0]);
      expect(sent.payload.fallbackMode).toBe('text-only');
    });

    it('does not send if WebSocket is closed', () => {
      const mockWs = {
        readyState: 3, // CLOSED
        OPEN: 1,
        send: vi.fn(),
      };

      sendErrorToClient(mockWs as any, ErrorCodes.UNKNOWN);

      expect(mockWs.send).not.toHaveBeenCalled();
    });
  });
});
