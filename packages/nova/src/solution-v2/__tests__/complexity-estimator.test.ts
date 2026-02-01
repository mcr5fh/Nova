import { describe, it, expect, vi } from 'vitest';
import {
  estimateComplexity,
  calculateBaseComplexity,
  adjustForIntegrations,
} from '../core/complexity-estimator.js';
import type { CodebaseContext, SolutionSpecV2, TShirtSize, TShirtSizeValue } from '../core/types.js';
import type { LLMAdapter, LLMResponse } from '../../shared/llm/types.js';

// Helper to create a mock LLM adapter
function createMockLLM(response: string): LLMAdapter {
  return {
    chat: vi.fn().mockResolvedValue({ content: response, stopReason: 'end_turn' } as LLMResponse),
    chatStream: vi.fn(),
  };
}

// Helper to create minimal codebase context
function createTestContext(overrides: Partial<CodebaseContext> = {}): CodebaseContext {
  return {
    files: [
      { path: 'src/api/users.ts', type: 'service', description: 'User service', relevance: 'high' },
    ],
    patterns: [],
    dependencies: [],
    techStack: ['TypeScript', 'Node.js'],
    architecture: 'Simple architecture',
    discoveredAt: Date.now(),
    ...overrides,
  };
}

// Helper to create minimal spec
function createTestSpec(overrides: Partial<SolutionSpecV2> = {}): SolutionSpecV2 {
  return {
    solutionSummary: 'A simple feature',
    userValue: 'Improves UX',
    scope: {
      included: ['Feature A'],
      excluded: [],
      futureConsiderations: [],
    },
    successCriteria: ['Works correctly'],
    userFlow: '',
    gaps: [],
    confidence: 'high',
    edgeCases: [],
    effortEstimate: { size: 'M', reasoning: '', confidence: 'medium', factors: [] },
    implementationDiagram: { type: 'flowchart', mermaid: '', description: '', generatedAt: Date.now() },
    technicalConstraints: [],
    ...overrides,
  };
}

describe('complexity-estimator', () => {
  describe('estimateComplexity', () => {
    it('should estimate small sizes for simple changes', async () => {
      const context = createTestContext({
        files: [{ path: 'src/config.ts', type: 'config', description: 'Config file', relevance: 'high' }],
      });
      const spec = createTestSpec({
        scope: { included: ['Update config value'], excluded: [], futureConsiderations: [] },
        technicalConstraints: [],
      });

      const result = await estimateComplexity(context, spec);

      // 1 file (1.5) + 1 scope (2) = 3.5 -> S
      expect(['XS', 'S']).toContain(result.size);
      expect(result.factors.length).toBeGreaterThan(0);
    });

    it('should estimate larger sizes for complex features', async () => {
      const context = createTestContext({
        files: [
          { path: 'src/api/users.ts', type: 'service', description: 'User API', relevance: 'high' },
          { path: 'src/api/orders.ts', type: 'service', description: 'Order API', relevance: 'high' },
          { path: 'src/db/users.ts', type: 'repository', description: 'User repo', relevance: 'high' },
          { path: 'src/db/orders.ts', type: 'repository', description: 'Order repo', relevance: 'high' },
          { path: 'src/jobs/sync.ts', type: 'worker', description: 'Sync job', relevance: 'high' },
        ],
        patterns: [
          { name: 'CQRS', location: 'src/', description: 'Command Query Separation', examples: [] },
        ],
        dependencies: [
          { name: 'stripe', version: '^12.0.0', type: 'production', usage: 'Payments' },
        ],
      });
      const spec = createTestSpec({
        scope: {
          included: ['Payment integration', 'Order processing', 'User notifications', 'Refund handling'],
          excluded: [],
          futureConsiderations: [],
        },
        technicalConstraints: ['Must integrate with Stripe', 'Must handle webhooks'],
        edgeCases: [
          { id: 'ec1', description: 'Payment failure', source: 'llm_inference', severity: 'critical', recommendation: 'Retry', discoveredAt: Date.now() },
          { id: 'ec2', description: 'Webhook timeout', source: 'llm_inference', severity: 'high', recommendation: 'Queue', discoveredAt: Date.now() },
        ],
      });

      const result = await estimateComplexity(context, spec);

      expect(['L', 'XL']).toContain(result.size);
    });

    it('should provide reasoning for estimate', async () => {
      const context = createTestContext();
      const spec = createTestSpec();

      const result = await estimateComplexity(context, spec);

      expect(result.reasoning).toBeTruthy();
      expect(result.reasoning.length).toBeGreaterThan(10);
    });

    it('should list factors that influenced estimate', async () => {
      const context = createTestContext({
        files: [
          { path: 'src/api/users.ts', type: 'service', description: 'User API', relevance: 'high' },
          { path: 'src/api/auth.ts', type: 'service', description: 'Auth API', relevance: 'high' },
        ],
      });
      const spec = createTestSpec({
        scope: { included: ['Feature A', 'Feature B'], excluded: [], futureConsiderations: [] },
      });

      const result = await estimateComplexity(context, spec);

      expect(result.factors.length).toBeGreaterThan(0);
      expect(result.factors.some(f => f.toLowerCase().includes('file'))).toBe(true);
    });
  });

  describe('calculateBaseComplexity', () => {
    it('should return XS for minimal changes', () => {
      // Score: 1*1.5 + 0*2 + 0 + 0 = 1.5 <= 3 = XS
      const result = calculateBaseComplexity(1, 0, 0, 0);
      expect(result).toBe('XS');
    });

    it('should return S for small changes', () => {
      // Score: 1*1.5 + 2*2 + 0 + 0 = 5.5 <= 6 = S
      const result = calculateBaseComplexity(1, 2, 0, 0);
      expect(result).toBe('S');
    });

    it('should return M for medium changes', () => {
      // Score: 2*1.5 + 3*2 + 1 + 0.5 = 3 + 6 + 1 + 0.5 = 10.5 <= 12 = M
      const result = calculateBaseComplexity(2, 3, 1, 1);
      expect(result).toBe('M');
    });

    it('should return L for large changes', () => {
      // Score: 4*1.5 + 5*2 + 2 + 1.5 = 6 + 10 + 2 + 1.5 = 19.5 <= 20 = L
      const result = calculateBaseComplexity(4, 5, 2, 3);
      expect(result).toBe('L');
    });

    it('should return XL for very large changes', () => {
      // Score: 10*1.5 + 8*2 + 4 + 2.5 = 15 + 16 + 4 + 2.5 = 37.5 > 20 = XL
      const result = calculateBaseComplexity(10, 8, 4, 5);
      expect(result).toBe('XL');
    });

    it('should increase size with more edge cases', () => {
      const withoutEdgeCases = calculateBaseComplexity(3, 3, 0, 0);
      const withEdgeCases = calculateBaseComplexity(3, 3, 0, 5);

      const sizeOrder: TShirtSizeValue[] = ['XS', 'S', 'M', 'L', 'XL'];
      expect(sizeOrder.indexOf(withEdgeCases)).toBeGreaterThanOrEqual(sizeOrder.indexOf(withoutEdgeCases));
    });
  });

  describe('adjustForIntegrations', () => {
    it('should increase size for external integrations', () => {
      const context = createTestContext({
        dependencies: [
          { name: 'stripe', version: '1.0.0', type: 'production', usage: 'Payments' },
          { name: 'twilio', version: '1.0.0', type: 'production', usage: 'SMS' },
        ],
      });
      const spec = createTestSpec({
        technicalConstraints: ['Must integrate with payment API'],
      });

      const baseSize: TShirtSizeValue = 'S';
      const adjusted = adjustForIntegrations(baseSize, context, spec);

      const sizeOrder: TShirtSizeValue[] = ['XS', 'S', 'M', 'L', 'XL'];
      expect(sizeOrder.indexOf(adjusted)).toBeGreaterThanOrEqual(sizeOrder.indexOf(baseSize));
    });

    it('should not decrease size', () => {
      const context = createTestContext({ dependencies: [] });
      const spec = createTestSpec({ technicalConstraints: [] });

      const baseSize: TShirtSizeValue = 'M';
      const adjusted = adjustForIntegrations(baseSize, context, spec);

      expect(adjusted).toBe(baseSize);
    });

    it('should cap at XL', () => {
      // Use integration dependency names to trigger the adjustment
      const context = createTestContext({
        dependencies: [
          { name: 'stripe', version: '1.0.0', type: 'production', usage: 'Payments' },
          { name: 'twilio', version: '1.0.0', type: 'production', usage: 'SMS' },
          { name: 'sendgrid', version: '1.0.0', type: 'production', usage: 'Email' },
        ],
      });
      const spec = createTestSpec({
        technicalConstraints: [
          'Must integrate with Stripe API',
          'Must integrate with Twilio API',
          'Must use external SendGrid service',
        ],
      });

      const adjusted = adjustForIntegrations('L', context, spec);

      expect(adjusted).toBe('XL');
    });
  });
});
