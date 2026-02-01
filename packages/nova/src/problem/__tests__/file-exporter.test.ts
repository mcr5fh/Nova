import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fs from 'fs/promises';
import {
  exportToJson,
  exportToMarkdown,
  exportSession,
  exportToProjectMarkdown,
  writeProjectFile,
  detectSaveIntent,
} from '../core/file-exporter.js';
import { createSession, applyEvaluation } from '../core/state-machine.js';
import type { DimensionId, SessionState } from '../core/types.js';

vi.mock('fs/promises');

function createTestSession(): SessionState {
  let session = createSession('test-export-session');

  // Add some evidence to dimensions
  session = applyEvaluation(session, {
    dimensionId: 'problem_clarity',
    newCoverage: 'strong',
    evidence: ['Users lose 4+ hours/week manually reconciling data'],
    reasoning: 'Clear problem statement',
  });

  session = applyEvaluation(session, {
    dimensionId: 'customer_context',
    newCoverage: 'strong',
    evidence: ['Finance teams at 50-500 employee companies during month-end close'],
    reasoning: 'Specific user segment',
  });

  session = applyEvaluation(session, {
    dimensionId: 'severity_frequency',
    newCoverage: 'partial',
    evidence: ['Weekly during reconciliation, blocks team for 1-2 days'],
    reasoning: 'Quantified frequency',
  });

  session = applyEvaluation(session, {
    dimensionId: 'root_cause',
    newCoverage: 'partial',
    evidence: ['Systems lack common data model, requiring manual translation'],
    reasoning: 'Root cause identified',
  });

  session = applyEvaluation(session, {
    dimensionId: 'business_impact',
    newCoverage: 'strong',
    evidence: ['Costs $200K/year in labor, primary driver of 15% enterprise churn'],
    reasoning: 'Quantified impact',
  });

  session = applyEvaluation(session, {
    dimensionId: 'validation',
    newCoverage: 'partial',
    evidence: ['Interview 10 finance managers, ask if they would pay $X to solve this'],
    reasoning: 'Concrete validation approach',
  });

  return session;
}

describe('file-exporter', () => {
  describe('exportToJson', () => {
    it('should export session state to valid JSON', () => {
      const session = createTestSession();
      const result = exportToJson(session);

      expect(() => JSON.parse(result)).not.toThrow();
    });

    it('should include problem statement fields in JSON export', () => {
      const session = createTestSession();
      const result = exportToJson(session);
      const parsed = JSON.parse(result);

      expect(parsed).toHaveProperty('problem');
      expect(parsed).toHaveProperty('who');
      expect(parsed).toHaveProperty('frequencySeverity');
      expect(parsed).toHaveProperty('businessImpact');
      expect(parsed).toHaveProperty('validation');
      expect(parsed).toHaveProperty('confidence');
      expect(parsed).toHaveProperty('gaps');
    });

    it('should include metadata in JSON export', () => {
      const session = createTestSession();
      const result = exportToJson(session);
      const parsed = JSON.parse(result);

      expect(parsed).toHaveProperty('metadata');
      expect(parsed.metadata).toHaveProperty('sessionId');
      expect(parsed.metadata).toHaveProperty('exportedAt');
      expect(parsed.metadata).toHaveProperty('version');
    });

    it('should include dimensions summary in JSON export', () => {
      const session = createTestSession();
      const result = exportToJson(session);
      const parsed = JSON.parse(result);

      expect(parsed).toHaveProperty('dimensions');
      expect(parsed.dimensions).toHaveProperty('problem_clarity');
      expect(parsed.dimensions.problem_clarity).toHaveProperty('coverage');
      expect(parsed.dimensions.problem_clarity).toHaveProperty('evidence');
    });
  });

  describe('exportToMarkdown', () => {
    it('should export session state to Markdown format', () => {
      const session = createTestSession();
      const result = exportToMarkdown(session);

      expect(result).toContain('# Problem Statement');
    });

    it('should include all problem statement sections', () => {
      const session = createTestSession();
      const result = exportToMarkdown(session);

      expect(result).toContain('## Problem');
      expect(result).toContain('## Who');
      expect(result).toContain('## Frequency & Severity');
      expect(result).toContain('## Business Impact');
      expect(result).toContain('## Validation');
    });

    it('should include confidence level', () => {
      const session = createTestSession();
      const result = exportToMarkdown(session);

      expect(result).toMatch(/\*\*Confidence:\*\*\s*(HIGH|MEDIUM|LOW)/i);
    });

    it('should include gaps section when there are gaps', () => {
      const session = createSession('incomplete-session');
      const result = exportToMarkdown(session);

      expect(result).toContain('## Gaps');
    });

    it('should include metadata section', () => {
      const session = createTestSession();
      const result = exportToMarkdown(session);

      expect(result).toContain('---');
      expect(result).toContain('Session ID:');
      expect(result).toContain('Exported:');
    });
  });

  describe('exportSession', () => {
    it('should export to JSON when format is json', () => {
      const session = createTestSession();
      const result = exportSession(session, 'json');

      expect(() => JSON.parse(result)).not.toThrow();
    });

    it('should export to Markdown when format is markdown', () => {
      const session = createTestSession();
      const result = exportSession(session, 'markdown');

      expect(result).toContain('# Problem Statement');
    });

    it('should throw error for unsupported format', () => {
      const session = createTestSession();

      expect(() => exportSession(session, 'xml' as any)).toThrow('Unsupported export format: xml');
    });
  });

  describe('detectSaveIntent', () => {
    it('should detect "save this"', () => {
      const result = detectSaveIntent('save this');
      expect(result).toEqual({ shouldSave: true, projectName: null });
    });

    it('should detect "save it"', () => {
      const result = detectSaveIntent('save it');
      expect(result).toEqual({ shouldSave: true, projectName: null });
    });

    it('should detect "save" alone', () => {
      const result = detectSaveIntent('save');
      expect(result).toEqual({ shouldSave: true, projectName: null });
    });

    it('should detect "save as ProjectName"', () => {
      const result = detectSaveIntent('save as MyProject');
      expect(result).toEqual({ shouldSave: true, projectName: 'MyProject' });
    });

    it('should detect "save this as ProjectName"', () => {
      const result = detectSaveIntent('save this as Data Reconciliation');
      expect(result).toEqual({ shouldSave: true, projectName: 'Data Reconciliation' });
    });

    it('should detect "let\'s save this"', () => {
      const result = detectSaveIntent("let's save this");
      expect(result).toEqual({ shouldSave: true, projectName: null });
    });

    it('should detect "please save"', () => {
      const result = detectSaveIntent('please save');
      expect(result).toEqual({ shouldSave: true, projectName: null });
    });

    it('should not detect save in unrelated messages', () => {
      const result = detectSaveIntent('Tell me more about the problem');
      expect(result).toEqual({ shouldSave: false, projectName: null });
    });

    it('should not detect "save" in middle of sentence about something else', () => {
      const result = detectSaveIntent('how will this save time for users?');
      expect(result).toEqual({ shouldSave: false, projectName: null });
    });
  });

  describe('exportToProjectMarkdown', () => {
    it('should include Solution section placeholder', () => {
      const session = createTestSession();
      const result = exportToProjectMarkdown(session, 'Test Project');

      expect(result).toContain('## Solution');
      expect(result).toContain('*To be defined*');
    });

    it('should use project name in title', () => {
      const session = createTestSession();
      const result = exportToProjectMarkdown(session, 'My Cool Project');

      expect(result).toContain('# My Cool Project');
    });

    it('should include all problem statement sections', () => {
      const session = createTestSession();
      const result = exportToProjectMarkdown(session, 'Test');

      expect(result).toContain('## Problem');
      expect(result).toContain('## Who');
      expect(result).toContain('## Frequency & Severity');
      expect(result).toContain('## Business Impact');
      expect(result).toContain('## Validation');
    });
  });

  describe('writeProjectFile', () => {
    beforeEach(() => {
      vi.resetAllMocks();
    });

    it('should create specs/projects directory if needed', async () => {
      const session = createTestSession();
      vi.mocked(fs.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);

      await writeProjectFile(session, 'TestProject', '/base');

      expect(fs.mkdir).toHaveBeenCalledWith(
        '/base/specs/projects',
        { recursive: true }
      );
    });

    it('should write file with kebab-case filename', async () => {
      const session = createTestSession();
      vi.mocked(fs.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);

      const result = await writeProjectFile(session, 'My Cool Project', '/base');

      expect(fs.writeFile).toHaveBeenCalledWith(
        '/base/specs/projects/my-cool-project.md',
        expect.any(String),
        'utf-8'
      );
      expect(result).toBe('/base/specs/projects/my-cool-project.md');
    });

    it('should sanitize project names', async () => {
      const session = createTestSession();
      vi.mocked(fs.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);

      const result = await writeProjectFile(session, 'Project/With:Bad*Chars', '/base');

      expect(fs.writeFile).toHaveBeenCalledWith(
        '/base/specs/projects/project-with-bad-chars.md',
        expect.any(String),
        'utf-8'
      );
    });
  });
});
