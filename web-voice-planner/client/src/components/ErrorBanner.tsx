import { useEffect, useState } from 'react';

interface ErrorPayload {
  message: string;
  code: string;
  fallbackMode?: 'text-only' | 'text-input';
}

interface Props {
  error: ErrorPayload | null;
  onDismiss: () => void;
  autoDismissMs?: number;
}

/**
 * Displays error messages to the user with optional fallback mode hints.
 * Automatically dismisses after a configurable timeout for non-critical errors.
 */
export function ErrorBanner({ error, onDismiss, autoDismissMs = 5000 }: Props) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (error) {
      setIsVisible(true);

      // Don't auto-dismiss critical errors that require action
      const criticalCodes = ['SESSION_LOCKED', 'SESSION_NOT_FOUND', 'NO_ACTIVE_SESSION'];
      if (!criticalCodes.includes(error.code)) {
        const timer = setTimeout(() => {
          setIsVisible(false);
          setTimeout(onDismiss, 300); // Wait for fade animation
        }, autoDismissMs);
        return () => clearTimeout(timer);
      }
    } else {
      setIsVisible(false);
    }
  }, [error, autoDismissMs, onDismiss]);

  if (!error) return null;

  const getFallbackHint = () => {
    switch (error.fallbackMode) {
      case 'text-only':
        return 'Voice response unavailable. Using text mode.';
      case 'text-input':
        return 'Voice input failed. Please use the text input below.';
      default:
        return null;
    }
  };

  const fallbackHint = getFallbackHint();

  const getErrorIcon = () => {
    switch (error.code) {
      case 'WHISPER_ERROR':
      case 'TTS_ERROR':
        return '🎤'; // Voice-related
      case 'SESSION_LOCKED':
        return '🔒'; // Lock icon
      case 'CLAUDE_ERROR':
        return '🤖'; // AI icon
      case 'WEBSOCKET_ERROR':
        return '🔌'; // Connection
      case 'SPEC_SAVE_ERROR':
        return '💾'; // Save
      default:
        return '⚠️'; // Generic warning
    }
  };

  return (
    <div
      className={`error-banner ${isVisible ? 'visible' : ''}`}
      role="alert"
      aria-live="polite"
    >
      <span className="error-icon">{getErrorIcon()}</span>
      <div className="error-content">
        <span className="error-message">{error.message}</span>
        {fallbackHint && (
          <span className="fallback-hint">{fallbackHint}</span>
        )}
      </div>
      <button
        className="error-dismiss"
        onClick={() => {
          setIsVisible(false);
          setTimeout(onDismiss, 300);
        }}
        aria-label="Dismiss error"
      >
        ×
      </button>
    </div>
  );
}
