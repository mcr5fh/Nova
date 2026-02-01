/**
 * ConnectionStatus - Display connection state with visual feedback
 *
 * Features:
 * - Visual indicators for connection states (connected, connecting, disconnected, reconnecting)
 * - Retry button for manual reconnection
 * - Network status indicator
 * - Reconnection attempt counter with progress
 * - Error message display
 */
'use client';

import type { ConnectionState } from '../../hooks/useAgentChat';

export interface ConnectionStatusProps {
  connectionState: ConnectionState;
  isOnline: boolean;
  reconnectAttempts: number;
  maxReconnectAttempts?: number;
  lastError: Event | null;
  onRetry?: () => void;
}

export function ConnectionStatus({
  connectionState,
  isOnline,
  reconnectAttempts,
  maxReconnectAttempts = 5,
  lastError,
  onRetry,
}: ConnectionStatusProps) {
  // Don't show anything when connected
  if (connectionState === 'connected') {
    return null;
  }

  // Network offline message
  if (!isOnline) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 bg-yellow-50 border border-yellow-200 rounded text-sm text-yellow-800">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21 21M15.536 8.464a5 5 0 010 7.072m0 0l-2.829-2.829m-4.243 2.829a4.978 4.978 0 01-1.414-2.83m-1.414 5.658a9 9 0 01-2.167-9.238m7.824 2.167a1 1 0 111.414 1.414m-1.414-1.414L3 3m8.293 8.293l1.414 1.414"
          />
        </svg>
        <span className="flex-1">No internet connection</span>
      </div>
    );
  }

  // Connecting state
  if (connectionState === 'connecting') {
    return (
      <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 border border-blue-200 rounded text-sm text-blue-800">
        <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
        <span className="flex-1">Connecting...</span>
      </div>
    );
  }

  // Reconnecting state with progress
  if (connectionState === 'reconnecting') {
    return (
      <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 border border-blue-200 rounded text-sm text-blue-800">
        <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
        <span className="flex-1">
          Reconnecting... (attempt {reconnectAttempts}/{maxReconnectAttempts})
        </span>
      </div>
    );
  }

  // Disconnected state with error message and retry button
  if (connectionState === 'disconnected') {
    const hasMaxedOutAttempts = reconnectAttempts >= maxReconnectAttempts;

    return (
      <div className="px-3 py-2 bg-red-50 border border-red-200 rounded text-sm">
        <div className="flex items-center gap-2 text-red-800">
          <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <span className="flex-1 font-medium">
            {hasMaxedOutAttempts
              ? 'Connection failed'
              : 'Disconnected from server'}
          </span>
        </div>

        {lastError && (
          <p className="mt-1 text-xs text-red-700">
            Unable to connect to the agent server
          </p>
        )}

        {onRetry && (
          <button
            onClick={onRetry}
            className="mt-2 w-full px-3 py-1.5 bg-red-600 text-white rounded hover:bg-red-700 transition-colors text-xs font-medium"
          >
            Retry Connection
          </button>
        )}
      </div>
    );
  }

  return null;
}
