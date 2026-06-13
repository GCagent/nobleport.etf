import { describe, it, expect } from 'vitest';
import { ActionClass } from '../types';
import {
  EventProcessor,
  IdempotencyEnforcer,
  ReplayProtector,
  createEvent,
} from '../events';
import { NOW } from './helpers';

describe('IdempotencyEnforcer', () => {
  it('treats a key as processed only within the dedupe window', () => {
    const enforcer = new IdempotencyEnforcer(1_000);
    expect(enforcer.isProcessed('k', NOW)).toBe(false);
    enforcer.markProcessed('k', NOW);
    expect(enforcer.isProcessed('k', NOW + 500)).toBe(true);
    expect(enforcer.isProcessed('k', NOW + 1_000)).toBe(false);
  });

  it('prunes stale keys and reports how many were removed', () => {
    const enforcer = new IdempotencyEnforcer(1_000);
    enforcer.markProcessed('k', NOW);
    expect(enforcer.prune(NOW + 2_000)).toBe(1);
    expect(enforcer.isProcessed('k', NOW + 2_001)).toBe(false);
  });
});

describe('ReplayProtector (§9.3)', () => {
  it('allows the first execution of a payload hash', () => {
    const rp = new ReplayProtector();
    expect(rp.canExecute('hash', 'prop-1', false).allowed).toBe(true);
  });

  it('blocks re-execution of the same payload under the same proposal without a replay flag', () => {
    const rp = new ReplayProtector();
    rp.recordExecution('hash', 'prop-1');
    expect(rp.canExecute('hash', 'prop-1', false).allowed).toBe(false);
  });

  it('allows re-execution under a new proposal id', () => {
    const rp = new ReplayProtector();
    rp.recordExecution('hash', 'prop-1');
    expect(rp.canExecute('hash', 'prop-2', false).allowed).toBe(true);
  });

  it('allows re-execution when the replay flag is explicitly set', () => {
    const rp = new ReplayProtector();
    rp.recordExecution('hash', 'prop-1');
    expect(rp.canExecute('hash', 'prop-1', true).allowed).toBe(true);
  });
});

describe('createEvent', () => {
  it('populates required event metadata (§9.1)', () => {
    const event = createEvent({
      correlationId: 'corr-1',
      producer: 'octastack',
      actionClass: ActionClass.B_Proposal,
      targetEntityId: 'asset-1',
      payload: { foo: 'bar' },
    });
    expect(event.eventId).toBeTruthy();
    expect(event.correlationId).toBe('corr-1');
    expect(event.idempotencyKey).toContain('corr-1');
    expect(event.idempotencyKey).toContain('asset-1');
  });
});

describe('EventProcessor', () => {
  it('processes a new event and rejects a duplicate idempotency key', () => {
    const processor = new EventProcessor();
    const event = createEvent({
      correlationId: 'corr-1',
      producer: 'octastack',
      actionClass: ActionClass.B_Proposal,
      targetEntityId: 'asset-1',
      payload: {},
    });
    const first = processor.processEvent(event);
    expect(first.processed).toBe(true);

    const second = processor.processEvent(event);
    expect(second.processed).toBe(false);
    expect(second.reason).toMatch(/Duplicate/);

    expect(processor.getEventLog()).toHaveLength(1);
  });

  it('exposes its replay protector', () => {
    const processor = new EventProcessor();
    expect(processor.getReplayProtector()).toBeInstanceOf(ReplayProtector);
  });
});
