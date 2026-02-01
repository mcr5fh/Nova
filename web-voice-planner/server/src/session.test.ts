import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SessionManager } from './session';
import { rm } from 'fs/promises';

describe('SessionManager', () => {
  let manager: SessionManager;

  beforeEach(() => {
    manager = new SessionManager();
  });

  afterEach(async () => {
    await rm('.sessions', { recursive: true, force: true });
  });

  it('creates a new session with correct initial state', async () => {
    const session = await manager.createSession('test-feature');

    expect(session.id).toBeDefined();
    expect(session.slug).toBe('test-feature');
    expect(session.currentPhase).toBe('gathering');
    expect(session.dimensions.solution_clarity.coverage).toBe('not_started');
    expect(session.dimensions.user_value.coverage).toBe('not_started');
    expect(session.dimensions.scope_boundaries.coverage).toBe('not_started');
    expect(session.dimensions.success_criteria.coverage).toBe('not_started');
    expect(session.dimensions.technical_constraints.coverage).toBe('not_started');
    expect(session.dimensions.edge_cases.coverage).toBe('not_started');
    expect(session.conversationHistory).toEqual([]);
  });

  it('persists and recovers session from disk', async () => {
    const created = await manager.createSession('test-feature');

    // Create new manager instance (simulates server restart)
    const newManager = new SessionManager();
    const recovered = await newManager.getSession(created.id);

    expect(recovered).not.toBeNull();
    expect(recovered!.id).toBe(created.id);
    expect(recovered!.slug).toBe('test-feature');
    expect(recovered!.currentPhase).toBe('gathering');
  });

  it('returns null for non-existent session', async () => {
    const session = await manager.getSession('non-existent-id');
    expect(session).toBeNull();
  });

  it('updates session state', async () => {
    const session = await manager.createSession('test-feature');

    await manager.updateSession(session.id, {
      currentPhase: 'validation',
    });

    const updated = await manager.getSession(session.id);
    expect(updated!.currentPhase).toBe('validation');
  });

  it('updates session dimensions', async () => {
    const session = await manager.createSession('test-feature');

    await manager.updateSession(session.id, {
      dimensions: {
        ...session.dimensions,
        solution_clarity: { coverage: 'strong', evidence: ['clear description'] },
      },
    });

    const updated = await manager.getSession(session.id);
    expect(updated!.dimensions.solution_clarity.coverage).toBe('strong');
    expect(updated!.dimensions.solution_clarity.evidence).toEqual(['clear description']);
  });

  it('adds conversation entries', async () => {
    const session = await manager.createSession('test-feature');

    await manager.updateSession(session.id, {
      conversationHistory: [
        { role: 'user', content: 'Hello', timestamp: new Date().toISOString() },
        { role: 'assistant', content: 'Hi there!', timestamp: new Date().toISOString() },
      ],
    });

    const updated = await manager.getSession(session.id);
    expect(updated!.conversationHistory).toHaveLength(2);
    expect(updated!.conversationHistory[0].role).toBe('user');
    expect(updated!.conversationHistory[1].role).toBe('assistant');
  });

  it('throws when updating non-existent session', async () => {
    await expect(
      manager.updateSession('non-existent-id', { currentPhase: 'validation' })
    ).rejects.toThrow('Session non-existent-id not found');
  });

  it('deletes session from memory and disk', async () => {
    const session = await manager.createSession('test-feature');

    await manager.deleteSession(session.id);

    // Should return null after deletion
    const deleted = await manager.getSession(session.id);
    expect(deleted).toBeNull();

    // New manager should also not find it
    const newManager = new SessionManager();
    const fromDisk = await newManager.getSession(session.id);
    expect(fromDisk).toBeNull();
  });

  it('creates multiple independent sessions', async () => {
    const session1 = await manager.createSession('feature-one');
    const session2 = await manager.createSession('feature-two');

    expect(session1.id).not.toBe(session2.id);
    expect(session1.slug).toBe('feature-one');
    expect(session2.slug).toBe('feature-two');

    // Update one shouldn't affect the other
    await manager.updateSession(session1.id, { currentPhase: 'validation' });

    const updated1 = await manager.getSession(session1.id);
    const updated2 = await manager.getSession(session2.id);

    expect(updated1!.currentPhase).toBe('validation');
    expect(updated2!.currentPhase).toBe('gathering');
  });

  describe('session locking', () => {
    it('allows acquiring lock on unlocked session', async () => {
      const session = await manager.createSession('test-feature');

      const acquired = manager.acquireLock(session.id, 'client-1');

      expect(acquired).toBe(true);
    });

    it('allows same client to re-acquire lock', async () => {
      const session = await manager.createSession('test-feature');

      manager.acquireLock(session.id, 'client-1');
      const reacquired = manager.acquireLock(session.id, 'client-1');

      expect(reacquired).toBe(true);
    });

    it('prevents different client from acquiring lock', async () => {
      const session = await manager.createSession('test-feature');

      manager.acquireLock(session.id, 'client-1');
      const acquired = manager.acquireLock(session.id, 'client-2');

      expect(acquired).toBe(false);
    });

    it('detects session locked by other client', async () => {
      const session = await manager.createSession('test-feature');

      manager.acquireLock(session.id, 'client-1');

      expect(manager.isLockedByOther(session.id, 'client-1')).toBe(false);
      expect(manager.isLockedByOther(session.id, 'client-2')).toBe(true);
    });

    it('reports not locked when no lock exists', async () => {
      const session = await manager.createSession('test-feature');

      expect(manager.isLockedByOther(session.id, 'any-client')).toBe(false);
    });

    it('releases lock for owning client', async () => {
      const session = await manager.createSession('test-feature');

      manager.acquireLock(session.id, 'client-1');
      manager.releaseLock(session.id, 'client-1');

      // Now another client can acquire
      const acquired = manager.acquireLock(session.id, 'client-2');
      expect(acquired).toBe(true);
    });

    it('does not release lock for non-owning client', async () => {
      const session = await manager.createSession('test-feature');

      manager.acquireLock(session.id, 'client-1');
      manager.releaseLock(session.id, 'client-2'); // Wrong client

      // Original lock should still be held
      expect(manager.isLockedByOther(session.id, 'client-2')).toBe(true);
    });

    it('gets lock holder', async () => {
      const session = await manager.createSession('test-feature');

      expect(manager.getLockHolder(session.id)).toBeUndefined();

      manager.acquireLock(session.id, 'client-1');

      expect(manager.getLockHolder(session.id)).toBe('client-1');
    });

    it('maintains independent locks for different sessions', async () => {
      const session1 = await manager.createSession('feature-one');
      const session2 = await manager.createSession('feature-two');

      manager.acquireLock(session1.id, 'client-1');
      manager.acquireLock(session2.id, 'client-2');

      // Each client should own their own session lock
      expect(manager.isLockedByOther(session1.id, 'client-1')).toBe(false);
      expect(manager.isLockedByOther(session1.id, 'client-2')).toBe(true);
      expect(manager.isLockedByOther(session2.id, 'client-1')).toBe(true);
      expect(manager.isLockedByOther(session2.id, 'client-2')).toBe(false);
    });
  });
});
