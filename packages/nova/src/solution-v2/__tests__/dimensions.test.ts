import { describe, it, expect } from 'vitest';
import {
  DIMENSIONS_V2,
  canSignOffV2,
} from '../core/dimensions.js';
import type { DimensionIdV2, CoverageLevelV2 } from '../core/types.js';

describe('solution-v2 dimensions', () => {
  describe('DIMENSIONS_V2', () => {
    it('should include all v1 dimensions', () => {
      const v1Dimensions: DimensionIdV2[] = [
        'solution_clarity',
        'user_value',
        'scope_boundaries',
        'success_criteria',
      ];

      for (const dimId of v1Dimensions) {
        expect(DIMENSIONS_V2[dimId]).toBeDefined();
        expect(DIMENSIONS_V2[dimId].id).toBe(dimId);
      }
    });

    it('should include new v2 dimensions', () => {
      const v2Dimensions: DimensionIdV2[] = [
        'technical_constraints',
        'edge_cases',
      ];

      for (const dimId of v2Dimensions) {
        expect(DIMENSIONS_V2[dimId]).toBeDefined();
        expect(DIMENSIONS_V2[dimId].id).toBe(dimId);
      }
    });

    it('should have 6 total dimensions', () => {
      expect(Object.keys(DIMENSIONS_V2)).toHaveLength(6);
    });

    describe('technical_constraints dimension', () => {
      it('should have proper definition', () => {
        const dim = DIMENSIONS_V2.technical_constraints;

        expect(dim.name).toBe('Technical Constraints');
        expect(dim.description).toBeDefined();
        expect(dim.goal).toBeDefined();
        expect(dim.exampleGood).toBeDefined();
        expect(dim.exampleBad).toBeDefined();
        expect(dim.probeQuestions.length).toBeGreaterThan(0);
        expect(dim.signOffThreshold).toBe('partial');
      });

      it('should have relevant probe questions', () => {
        const dim = DIMENSIONS_V2.technical_constraints;
        const questionText = dim.probeQuestions.join(' ').toLowerCase();

        // Should ask about existing tech, constraints, integrations
        expect(
          questionText.includes('technology') ||
          questionText.includes('constraint') ||
          questionText.includes('existing') ||
          questionText.includes('integration')
        ).toBe(true);
      });
    });

    describe('edge_cases dimension', () => {
      it('should have proper definition', () => {
        const dim = DIMENSIONS_V2.edge_cases;

        expect(dim.name).toBe('Edge Cases');
        expect(dim.description).toBeDefined();
        expect(dim.goal).toBeDefined();
        expect(dim.exampleGood).toBeDefined();
        expect(dim.exampleBad).toBeDefined();
        expect(dim.probeQuestions.length).toBeGreaterThan(0);
        expect(dim.signOffThreshold).toBe('partial');
      });

      it('should have relevant probe questions', () => {
        const dim = DIMENSIONS_V2.edge_cases;
        const questionText = dim.probeQuestions.join(' ').toLowerCase();

        // Should ask about edge cases, failures, unusual scenarios
        expect(
          questionText.includes('edge') ||
          questionText.includes('fail') ||
          questionText.includes('wrong') ||
          questionText.includes('unusual')
        ).toBe(true);
      });
    });

    describe('all dimensions', () => {
      it('should have required properties', () => {
        for (const [id, dim] of Object.entries(DIMENSIONS_V2)) {
          expect(dim.id).toBe(id);
          expect(typeof dim.name).toBe('string');
          expect(typeof dim.description).toBe('string');
          expect(typeof dim.goal).toBe('string');
          expect(typeof dim.exampleGood).toBe('string');
          expect(typeof dim.exampleBad).toBe('string');
          expect(Array.isArray(dim.probeQuestions)).toBe(true);
          expect(['not_started', 'weak', 'partial', 'strong']).toContain(dim.signOffThreshold);
        }
      });

      it('v1 dimensions should require strong coverage', () => {
        const v1Dimensions: DimensionIdV2[] = [
          'solution_clarity',
          'user_value',
          'scope_boundaries',
          'success_criteria',
        ];

        for (const dimId of v1Dimensions) {
          expect(DIMENSIONS_V2[dimId].signOffThreshold).toBe('strong');
        }
      });

      it('v2 dimensions should require partial coverage', () => {
        const v2Dimensions: DimensionIdV2[] = [
          'technical_constraints',
          'edge_cases',
        ];

        for (const dimId of v2Dimensions) {
          expect(DIMENSIONS_V2[dimId].signOffThreshold).toBe('partial');
        }
      });
    });
  });

  describe('canSignOffV2', () => {
    it('should return not ready when all dimensions are not_started', () => {
      const states: Record<DimensionIdV2, { coverage: CoverageLevelV2 }> = {
        solution_clarity: { coverage: 'not_started' },
        user_value: { coverage: 'not_started' },
        scope_boundaries: { coverage: 'not_started' },
        success_criteria: { coverage: 'not_started' },
        technical_constraints: { coverage: 'not_started' },
        edge_cases: { coverage: 'not_started' },
      };

      const result = canSignOffV2(states);

      expect(result.ready).toBe(false);
      expect(result.gaps).toHaveLength(6);
    });

    it('should return ready when all thresholds are met', () => {
      const states: Record<DimensionIdV2, { coverage: CoverageLevelV2 }> = {
        solution_clarity: { coverage: 'strong' },
        user_value: { coverage: 'strong' },
        scope_boundaries: { coverage: 'strong' },
        success_criteria: { coverage: 'strong' },
        technical_constraints: { coverage: 'partial' },
        edge_cases: { coverage: 'partial' },
      };

      const result = canSignOffV2(states);

      expect(result.ready).toBe(true);
      expect(result.gaps).toHaveLength(0);
    });

    it('should identify gaps when v1 dimensions are only partial', () => {
      const states: Record<DimensionIdV2, { coverage: CoverageLevelV2 }> = {
        solution_clarity: { coverage: 'partial' },  // Gap: needs strong
        user_value: { coverage: 'strong' },
        scope_boundaries: { coverage: 'strong' },
        success_criteria: { coverage: 'strong' },
        technical_constraints: { coverage: 'partial' },
        edge_cases: { coverage: 'partial' },
      };

      const result = canSignOffV2(states);

      expect(result.ready).toBe(false);
      expect(result.gaps).toContain('solution_clarity');
      expect(result.gaps).toHaveLength(1);
    });

    it('should accept v2 dimensions at partial coverage', () => {
      const states: Record<DimensionIdV2, { coverage: CoverageLevelV2 }> = {
        solution_clarity: { coverage: 'strong' },
        user_value: { coverage: 'strong' },
        scope_boundaries: { coverage: 'strong' },
        success_criteria: { coverage: 'strong' },
        technical_constraints: { coverage: 'partial' },  // OK at partial
        edge_cases: { coverage: 'partial' },             // OK at partial
      };

      const result = canSignOffV2(states);

      expect(result.ready).toBe(true);
      expect(result.gaps).not.toContain('technical_constraints');
      expect(result.gaps).not.toContain('edge_cases');
    });

    it('should identify v2 dimension gaps when below partial', () => {
      const states: Record<DimensionIdV2, { coverage: CoverageLevelV2 }> = {
        solution_clarity: { coverage: 'strong' },
        user_value: { coverage: 'strong' },
        scope_boundaries: { coverage: 'strong' },
        success_criteria: { coverage: 'strong' },
        technical_constraints: { coverage: 'weak' },      // Gap: needs partial
        edge_cases: { coverage: 'not_started' },          // Gap: needs partial
      };

      const result = canSignOffV2(states);

      expect(result.ready).toBe(false);
      expect(result.gaps).toContain('technical_constraints');
      expect(result.gaps).toContain('edge_cases');
      expect(result.gaps).toHaveLength(2);
    });

    it('should handle exceeding thresholds', () => {
      const states: Record<DimensionIdV2, { coverage: CoverageLevelV2 }> = {
        solution_clarity: { coverage: 'strong' },
        user_value: { coverage: 'strong' },
        scope_boundaries: { coverage: 'strong' },
        success_criteria: { coverage: 'strong' },
        technical_constraints: { coverage: 'strong' },  // Exceeds partial
        edge_cases: { coverage: 'strong' },             // Exceeds partial
      };

      const result = canSignOffV2(states);

      expect(result.ready).toBe(true);
      expect(result.gaps).toHaveLength(0);
    });
  });
});
