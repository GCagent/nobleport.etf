/**
 * NoblePort Roofing tests.
 *
 * Asserts the financial integrity of the generated proposal (line items
 * reconcile to the subtotal, payment milestones sum to 100% and to the total)
 * and the structural integrity of the fall-protection program (the safety gates
 * that authorize work actually exist and reference the OSHA threshold).
 */

import { describe, it, expect } from 'vitest';
import { proposal20_61st, roofingProposals } from '../proposals';
import { fallProtectionProgram } from '../fall-protection';

describe('roofing proposal financials', () => {
  it('line items reconcile to the subtotal', () => {
    const sum = proposal20_61st.lineItems.reduce((s, li) => s + li.amount, 0);
    expect(sum).toBe(proposal20_61st.subtotal);
  });

  it('payment milestones sum to 100% and to the total', () => {
    const pctSum = proposal20_61st.paymentSchedule.reduce((s, m) => s + m.pct, 0);
    expect(pctSum).toBeCloseTo(1.0, 6);

    const amtSum = proposal20_61st.paymentSchedule.reduce((s, m) => s + m.amount, 0);
    expect(amtSum).toBe(proposal20_61st.total);
  });

  it('enforces deposit-before-schedule on the first milestone', () => {
    const deposit = proposal20_61st.paymentSchedule[0];
    expect(deposit.milestone).toBe('Deposit');
    expect(deposit.gate.toLowerCase()).toContain('no deposit');
  });

  it('investment band is ordered and the high end carries contingency', () => {
    // low is the subtotal rounded to the nearest $50; high adds contingency.
    expect(proposal20_61st.investmentLow).toBeLessThanOrEqual(proposal20_61st.investmentHigh);
    expect(proposal20_61st.investmentHigh).toBeGreaterThanOrEqual(proposal20_61st.subtotal);
    expect(proposal20_61st.contingencyAmount).toBeGreaterThan(0);
  });

  it('registers the proposal in the catalog', () => {
    expect(roofingProposals).toContain(proposal20_61st);
  });
});

describe('fall-protection program', () => {
  it('uses the OSHA 6-foot threshold and a 5,000 lb anchor', () => {
    expect(fallProtectionProgram.oshaThresholdFeet).toBe(6);
    expect(fallProtectionProgram.anchorCapacityLbs).toBe(5000);
  });

  it('defines work-authorization gates and a workflow', () => {
    expect(fallProtectionProgram.gateLogic.length).toBeGreaterThan(0);
    expect(fallProtectionProgram.workflow.length).toBeGreaterThan(0);
    expect(fallProtectionProgram.safetyRules.length).toBeGreaterThan(0);
  });

  it('every safety rule cites a rule and an authority', () => {
    for (const rule of fallProtectionProgram.safetyRules) {
      expect(rule.rule.length).toBeGreaterThan(0);
      expect(rule.authority.length).toBeGreaterThan(0);
    }
  });
});
