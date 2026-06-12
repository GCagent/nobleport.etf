/**
 * NoblePort Realty tests.
 *
 * Asserts the integrity of the property-analysis model: a valid recommendation
 * and bounded overall score, a populated scorecard whose dimension scores stay
 * in range, and registration in the analyses catalog.
 */

import { describe, it, expect } from 'vitest';
import { property236HighRoad, propertyAnalyses } from '../property-analysis';

describe('property analysis: 236 High Road', () => {
  it('carries a valid recommendation and bounded score', () => {
    expect(['buy', 'hold', 'pass']).toContain(property236HighRoad.recommendation);
    expect(property236HighRoad.overallScore).toBeGreaterThanOrEqual(0);
    expect(property236HighRoad.overallScore).toBeLessThanOrEqual(10);
  });

  it('has a populated scorecard with in-range dimension scores', () => {
    expect(property236HighRoad.scorecard.length).toBeGreaterThan(0);
    for (const row of property236HighRoad.scorecard) {
      expect(row.dimension.length).toBeGreaterThan(0);
      expect(row.score).toBeGreaterThanOrEqual(0);
      expect(row.score).toBeLessThanOrEqual(10);
    }
  });

  it('identifies the subject address', () => {
    expect(property236HighRoad.address).toContain('236 High Road');
  });

  it('is registered in the analyses catalog', () => {
    expect(propertyAnalyses).toContain(property236HighRoad);
  });
});
