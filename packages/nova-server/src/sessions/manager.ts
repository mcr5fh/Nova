/**
 * Session Manager - Maps WebSocket connections to Nova sessions
 * 
 * Handles both ProblemAdvisor and SolutionArchitect modes
 */

import { ProblemAdvisor, SolutionArchitect } from 'nova';
import type { ProblemSessionState, SolutionSessionState } from 'nova';
import type { SessionMode, DimensionInfo } from '../websocket/messages.js';

export interface ManagedSession {
  id: string;
  mode: SessionMode;
  advisor: ProblemAdvisor | SolutionArchitect;
  createdAt: number;
  lastActivityAt: number;
}

export interface SessionManagerConfig {
  apiKey: string;
  modelId?: string;
  basePath?: string;
}

export class SessionManager {
  private sessions: Map<string, ManagedSession> = new Map();
  private config: SessionManagerConfig;

  constructor(config: SessionManagerConfig) {
    this.config = config;
  }

  /**
   * Create a new session with the specified mode
   */
  createSession(mode: SessionMode): ManagedSession {
    const advisorConfig = {
      llmProvider: 'anthropic' as const,
      modelId: this.config.modelId || 'claude-sonnet-4-20250514',
      apiKey: this.config.apiKey,
      streamResponses: true,
    };

    let advisor: ProblemAdvisor | SolutionArchitect;
    
    if (mode === 'problem') {
      advisor = new ProblemAdvisor(advisorConfig, this.config.basePath);
    } else {
      advisor = new SolutionArchitect(advisorConfig, this.config.basePath);
    }

    const { id, state } = advisor.startSession();

    const managedSession: ManagedSession = {
      id,
      mode,
      advisor,
      createdAt: Date.now(),
      lastActivityAt: Date.now(),
    };

    this.sessions.set(id, managedSession);
    return managedSession;
  }

  /**
   * Resume an existing session by ID
   */
  getSession(sessionId: string): ManagedSession | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * Check if a session exists
   */
  hasSession(sessionId: string): boolean {
    return this.sessions.has(sessionId);
  }

  /**
   * Update last activity timestamp
   */
  touchSession(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.lastActivityAt = Date.now();
    }
  }

  /**
   * Get session state for progress updates
   */
  getSessionState(sessionId: string): ProblemSessionState | SolutionSessionState | undefined {
    const session = this.sessions.get(sessionId);
    if (!session) return undefined;
    return session.advisor.getState(sessionId);
  }

  /**
   * Extract dimension info from session state for progress updates
   */
  getDimensionInfo(sessionId: string): { dimensions: DimensionInfo[]; currentFocus: string | null } {
    const state = this.getSessionState(sessionId);
    if (!state) {
      return { dimensions: [], currentFocus: null };
    }

    const dimensions: DimensionInfo[] = Object.values(state.dimensions).map((dim) => ({
      id: dim.id,
      coverage: dim.coverage,
      evidence: dim.evidence,
    }));

    return {
      dimensions,
      currentFocus: state.currentFocus,
    };
  }

  /**
   * Chat with the session's advisor
   * Returns an async iterator of response chunks
   */
  async *chat(sessionId: string, userMessage: string): AsyncIterable<{
    type: 'text' | 'done' | 'progress' | 'saved' | 'loaded';
    text?: string;
    saveResult?: { saved: boolean; filePath?: string };
  }> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    this.touchSession(sessionId);

    // Both ProblemAdvisor and SolutionArchitect have the same chat() signature
    for await (const chunk of session.advisor.chat(sessionId, userMessage)) {
      yield chunk;
    }
  }

  /**
   * Remove a session
   */
  removeSession(sessionId: string): boolean {
    return this.sessions.delete(sessionId);
  }

  /**
   * Get all active session IDs
   */
  getActiveSessionIds(): string[] {
    return Array.from(this.sessions.keys());
  }

  /**
   * Clean up stale sessions (older than maxAge milliseconds)
   */
  cleanupStaleSessions(maxAge: number = 60 * 60 * 1000): number {
    const now = Date.now();
    let removed = 0;

    for (const [id, session] of this.sessions) {
      if (now - session.lastActivityAt > maxAge) {
        this.sessions.delete(id);
        removed++;
      }
    }

    return removed;
  }
}
