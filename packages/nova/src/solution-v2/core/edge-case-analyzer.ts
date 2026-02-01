import type { CodebaseContext, EdgeCase, EdgeCaseSeverity, MessageV2 } from './types.js';
import type { LLMAdapter } from '../../shared/llm/types.js';

/** Category types for edge cases based on source */
export type EdgeCaseCategory = 'code-pattern' | 'business-rule' | 'technical-constraint';

/** Parsed edge case from LLM response */
export interface ParsedEdgeCase {
  severity: EdgeCaseSeverity;
  description: string;
  affectedFiles?: string[];
  recommendation: string;
}

/**
 * Analyze edge cases by combining codebase patterns with conversation context.
 * Returns a list of identified edge cases categorized by source.
 */
export async function analyzeEdgeCases(
  context: CodebaseContext,
  conversation: MessageV2[],
  llm: LLMAdapter
): Promise<EdgeCase[]> {
  const prompt = buildEdgeCasePrompt(context, conversation);

  try {
    const response = await llm.chat(
      [{ role: 'user', content: prompt }],
      'You are a software architect identifying edge cases and failure modes. Be thorough and practical.'
    );

    const parsed = parseEdgeCasesFromResponse(response.content);
    return parsed.map((ec, idx) => toEdgeCase(ec, idx));
  } catch {
    return [];
  }
}

/**
 * Build the prompt for edge case analysis
 */
function buildEdgeCasePrompt(context: CodebaseContext, conversation: MessageV2[]): string {
  const conversationSummary = conversation
    .slice(-15)
    .map(m => `${m.role}: ${m.content}`)
    .join('\n\n');

  const patternsList = context.patterns
    .map(p => `- ${p.name}: ${p.description}`)
    .join('\n');

  const filesList = context.files
    .filter(f => f.relevance === 'high')
    .map(f => `- ${f.path}: ${f.description}`)
    .join('\n');

  const techStackStr = context.techStack.join(', ');

  return `Analyze the following solution discussion and codebase context to identify edge cases.

## Tech Stack
${techStackStr || 'Not specified'}

## Existing Patterns
${patternsList || 'None identified'}

## Relevant Files
${filesList || 'None identified'}

## Conversation Context
${conversationSummary || 'No conversation yet'}

## Instructions
Identify edge cases, failure modes, and boundary conditions that the solution should handle.
Consider:
1. Network/infrastructure failures
2. Invalid or edge-case inputs
3. Concurrency issues
4. Resource exhaustion
5. Security concerns
6. Integration failures with external systems

Format each edge case as:
N. [severity] Description - Files: file1.ts, file2.ts - Recommendation: How to handle

Where severity is one of: critical, high, medium, low

List 3-8 edge cases, prioritized by severity.`;
}

/**
 * Parse edge cases from LLM response text
 */
export function parseEdgeCasesFromResponse(response: string): ParsedEdgeCase[] {
  const edgeCases: ParsedEdgeCase[] = [];
  const lines = response.split('\n');

  for (const line of lines) {
    // Match numbered items like "1. [critical] Description - Files: ... - Recommendation: ..."
    const match = line.match(/^\d+\.\s*(?:\[(\w+)\])?\s*(.+?)(?:\s*-\s*Files?:\s*([^-]+))?(?:\s*-\s*Recommendation:\s*(.+))?$/i);

    if (match) {
      const [, severityStr, description, filesStr, recommendation] = match;
      const severity = parseSeverity(severityStr);
      const affectedFiles = filesStr
        ? filesStr.split(',').map(f => f.trim()).filter(f => f.length > 0)
        : undefined;

      if (description && recommendation) {
        edgeCases.push({
          severity,
          description: description.trim(),
          affectedFiles: affectedFiles && affectedFiles.length > 0 ? affectedFiles : undefined,
          recommendation: recommendation.trim(),
        });
      }
    }
  }

  return edgeCases;
}

/**
 * Parse severity string to typed severity
 */
function parseSeverity(str?: string): EdgeCaseSeverity {
  if (!str) return 'medium';
  const lower = str.toLowerCase();
  if (lower === 'critical') return 'critical';
  if (lower === 'high') return 'high';
  if (lower === 'low') return 'low';
  return 'medium';
}

/**
 * Convert parsed edge case to full EdgeCase object
 */
function toEdgeCase(parsed: ParsedEdgeCase, index: number): EdgeCase {
  return {
    id: `ec-${Date.now()}-${index}`,
    description: parsed.description,
    source: 'llm_inference',
    severity: parsed.severity,
    recommendation: parsed.recommendation,
    affectedFiles: parsed.affectedFiles,
    discoveredAt: Date.now(),
  };
}

/**
 * Categorize an edge case by its source
 */
export function categorizeEdgeCase(edgeCase: EdgeCase): EdgeCaseCategory {
  switch (edgeCase.source) {
    case 'codebase_analysis':
      return 'code-pattern';
    case 'user_input':
      return 'business-rule';
    case 'llm_inference':
    default:
      return 'technical-constraint';
  }
}
