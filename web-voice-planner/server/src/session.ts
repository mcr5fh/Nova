import { v4 as uuid } from 'uuid';
import { writeFile, readFile, mkdir, unlink } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import type { SessionState } from '../../shared/types';

const SESSIONS_DIR = '.sessions';

export class SessionManager {
  private sessions: Map<string, SessionState> = new Map();
  private locks: Map<string, string> = new Map(); // sessionId -> clientId

  async createSession(slug: string): Promise<SessionState> {
    const session: SessionState = {
      id: uuid(),
      slug,
      startedAt: new Date().toISOString(),
      currentPhase: 'gathering',
      dimensions: {
        solution_clarity: { coverage: 'not_started', evidence: [] },
        user_value: { coverage: 'not_started', evidence: [] },
        scope_boundaries: { coverage: 'not_started', evidence: [] },
        success_criteria: { coverage: 'not_started', evidence: [] },
        technical_constraints: { coverage: 'not_started', evidence: [] },
        edge_cases: { coverage: 'not_started', evidence: [] },
      },
      conversationHistory: [],
    };

    this.sessions.set(session.id, session);
    await this.persistSession(session);
    return session;
  }

  async getSession(sessionId: string): Promise<SessionState | null> {
    // Check memory first
    if (this.sessions.has(sessionId)) {
      return this.sessions.get(sessionId)!;
    }

    // Try to load from disk
    return this.loadSession(sessionId);
  }

  async updateSession(sessionId: string, updates: Partial<SessionState>): Promise<SessionState> {
    const session = await this.getSession(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    const updated = { ...session, ...updates };
    this.sessions.set(sessionId, updated);
    await this.persistSession(updated);
    return updated;
  }

  async deleteSession(sessionId: string): Promise<void> {
    this.sessions.delete(sessionId);
    const filePath = path.join(SESSIONS_DIR, `${sessionId}.json`);
    if (existsSync(filePath)) {
      await unlink(filePath);
    }
  }

  private async persistSession(session: SessionState): Promise<void> {
    if (!existsSync(SESSIONS_DIR)) {
      await mkdir(SESSIONS_DIR, { recursive: true });
    }
    const filePath = path.join(SESSIONS_DIR, `${session.id}.json`);
    await writeFile(filePath, JSON.stringify(session, null, 2));
  }

  private async loadSession(sessionId: string): Promise<SessionState | null> {
    const filePath = path.join(SESSIONS_DIR, `${sessionId}.json`);
    if (!existsSync(filePath)) {
      return null;
    }
    const data = await readFile(filePath, 'utf-8');
    const session = JSON.parse(data) as SessionState;
    this.sessions.set(sessionId, session);
    return session;
  }

  /**
   * Attempts to acquire a lock on a session for a specific client.
   * If the session is already locked by another client, returns false.
   * If the session is unlocked or already owned by this client, acquires/retains the lock.
   *
   * @param sessionId - The session to lock
   * @param clientId - The client attempting to acquire the lock
   * @returns true if lock acquired, false if locked by another client
   */
  acquireLock(sessionId: string, clientId: string): boolean {
    const currentLock = this.locks.get(sessionId);
    if (currentLock && currentLock !== clientId) {
      return false; // Session locked by another client
    }
    this.locks.set(sessionId, clientId);
    return true;
  }

  /**
   * Releases a lock on a session if held by the specified client.
   *
   * @param sessionId - The session to unlock
   * @param clientId - The client releasing the lock
   */
  releaseLock(sessionId: string, clientId: string): void {
    if (this.locks.get(sessionId) === clientId) {
      this.locks.delete(sessionId);
    }
  }

  /**
   * Checks if a session is locked by a different client.
   *
   * @param sessionId - The session to check
   * @param clientId - The client checking the lock
   * @returns true if locked by another client, false otherwise
   */
  isLockedByOther(sessionId: string, clientId: string): boolean {
    const lock = this.locks.get(sessionId);
    return lock !== undefined && lock !== clientId;
  }

  /**
   * Gets the client ID that holds the lock on a session.
   *
   * @param sessionId - The session to check
   * @returns The client ID or undefined if not locked
   */
  getLockHolder(sessionId: string): string | undefined {
    return this.locks.get(sessionId);
  }
}
