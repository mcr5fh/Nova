import type { SessionState, DimensionId, EvaluationResult, CoverageLevel } from './types.js';
import { DIMENSIONS } from './dimensions.js';
import { buildEvaluationPrompt } from './prompt-builder.js';
import type { LLMAdapter } from '../../shared/llm/types.js';

export async function evaluateAllDimensions(
  state: SessionState,
  userMessage: string,
  llm: LLMAdapter
): Promise<EvaluationResult[]> {
  const conversationContext = state.conversationHistory
    .slice(-10) // Last 10 messages for context
    .map(m => `${m.role}: ${m.content}`)
    .join('\n\n');

  // Evaluate each dimension in parallel
  const evaluations = await Promise.all(
    (Object.keys(DIMENSIONS) as DimensionId[]).map(async (dimId) => {
      const prompt = buildEvaluationPrompt(userMessage, conversationContext, dimId);

      try {
        const response = await llm.chat(
          [{ role: 'user', content: prompt }],
          'You are a precise evaluator. Respond only with valid JSON.'
        );

        const parsed = JSON.parse(response.content);
        return {
          dimensionId: dimId,
          newCoverage: parsed.coverage as CoverageLevel,
          evidence: parsed.evidence || [],
          reasoning: parsed.reasoning || '',
        };
      } catch (e) {
        // On parse error, return no change
        return {
          dimensionId: dimId,
          newCoverage: state.dimensions[dimId].coverage,
          evidence: [],
          reasoning: 'Evaluation failed',
        };
      }
    })
  );

  return evaluations;
}

// Lighter-weight evaluation that only checks relevant dimensions
export async function evaluateFocusedDimension(
  state: SessionState,
  userMessage: string,
  llm: LLMAdapter
): Promise<EvaluationResult | null> {
  if (!state.currentFocus) return null;

  const dimId = state.currentFocus;
  const conversationContext = state.conversationHistory
    .slice(-6)
    .map(m => `${m.role}: ${m.content}`)
    .join('\n\n');

  const prompt = buildEvaluationPrompt(userMessage, conversationContext, dimId);

  try {
    const response = await llm.chat(
      [{ role: 'user', content: prompt }],
      'You are a precise evaluator. Respond only with valid JSON.'
    );

    const parsed = JSON.parse(response.content);
    return {
      dimensionId: dimId,
      newCoverage: parsed.coverage as CoverageLevel,
      evidence: parsed.evidence || [],
      reasoning: parsed.reasoning || '',
    };
  } catch {
    return null;
  }
}
