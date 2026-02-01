'use client';

import { useState, useEffect, useCallback } from 'react';
import { ServerEvent } from '@/types/chat';

const STORAGE_KEY_SESSION = 'nova_chat_session_id';
const STORAGE_KEY_HISTORY = 'nova_chat_history';

/**
 * Generate a UUID v4 session identifier
 */
function generateSessionId(): string {
  // UUID v4 format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
  // where x is any hexadecimal digit and y is one of 8, 9, A, or B
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Safely get item from localStorage with fallback
 */
function getLocalStorageItem(key: string): string | null {
  if (typeof window === 'undefined') {
    return null;
  }
  try {
    return localStorage.getItem(key);
  } catch (e) {
    console.error(`Failed to read from localStorage: ${key}`, e);
    return null;
  }
}

/**
 * Safely set item in localStorage
 */
function setLocalStorageItem(key: string, value: string): void {
  if (typeof window === 'undefined') {
    return;
  }
  try {
    localStorage.setItem(key, value);
  } catch (e) {
    console.error(`Failed to write to localStorage: ${key}`, e);
  }
}

/**
 * Safely remove item from localStorage
 */
function removeLocalStorageItem(key: string): void {
  if (typeof window === 'undefined') {
    return;
  }
  try {
    localStorage.removeItem(key);
  } catch (e) {
    console.error(`Failed to remove from localStorage: ${key}`, e);
  }
}

/**
 * Hook to manage chat session persistence
 *
 * Features:
 * - Generates or retrieves session_id from localStorage
 * - Stores chat history in localStorage
 * - Provides function to clear session and history
 *
 * @returns Object with sessionId, history, addToHistory, and clearSession
 */
export function useChatSession() {
  // Initialize session ID from localStorage or generate new one
  const [sessionId, setSessionId] = useState<string>(() => {
    const stored = getLocalStorageItem(STORAGE_KEY_SESSION);
    if (stored) {
      return stored;
    }
    const newSessionId = generateSessionId();
    setLocalStorageItem(STORAGE_KEY_SESSION, newSessionId);
    return newSessionId;
  });

  // Initialize history from localStorage
  const [history, setHistory] = useState<ServerEvent[]>(() => {
    const stored = getLocalStorageItem(STORAGE_KEY_HISTORY);
    if (!stored) {
      return [];
    }
    try {
      const parsed = JSON.parse(stored);
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      console.error('Failed to parse chat history from localStorage', e);
      return [];
    }
  });

  // Persist history to localStorage whenever it changes
  useEffect(() => {
    try {
      setLocalStorageItem(STORAGE_KEY_HISTORY, JSON.stringify(history));
    } catch (e) {
      console.error('Failed to persist chat history to localStorage', e);
    }
  }, [history]);

  /**
   * Add a new event to the chat history
   */
  const addToHistory = useCallback((event: ServerEvent) => {
    setHistory((prev) => [...prev, event]);
  }, []);

  /**
   * Clear the current session and all chat history
   * Generates a new session ID
   */
  const clearSession = useCallback(() => {
    // Generate new session ID
    const newSessionId = generateSessionId();
    setSessionId(newSessionId);
    setLocalStorageItem(STORAGE_KEY_SESSION, newSessionId);

    // Clear history
    setHistory([]);
    removeLocalStorageItem(STORAGE_KEY_HISTORY);
  }, []);

  return {
    sessionId,
    history,
    addToHistory,
    clearSession,
  };
}
