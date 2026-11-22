import { describe, expect, it } from 'vitest';
import type { Pause, Reminder } from '../../core';
import { dropReason, endsAtMidnight, todayLines } from './pauseDisplay';

const reminder = (id: string, firesAt: number): Reminder => ({ id, firesAt, suggestion: [], status: 'done' });
const MIN = 60_000;

describe("Today's lines", () => {
  it('sorts the Pauses in among the Reminders, newest first, a Pause by its start', () => {
    const r1 = reminder('r1', 10 * MIN);
    const r2 = reminder('r2', 40 * MIN);
    const r3 = reminder('r3', 100 * MIN);
    const p1: Pause = { from: 20 * MIN, until: 30 * MIN };
    const p2: Pause = { from: 50 * MIN, until: 90 * MIN };
    // todaysReminders gives newest first; todaysPauses oldest first.
    expect(todayLines([r3, r2, r1], [p1, p2])).toEqual([
      { kind: 'reminder', reminder: r3 },
      { kind: 'pause', pause: p2 },
      { kind: 'reminder', reminder: r2 },
      { kind: 'pause', pause: p1 },
      { kind: 'reminder', reminder: r1 },
    ]);
  });

  it('puts a Pause above a Reminder fired at the same instant', () => {
    const r = reminder('r', 10 * MIN);
    const p: Pause = { from: 10 * MIN, until: 70 * MIN };
    expect(todayLines([r], [p])).toEqual([
      { kind: 'pause', pause: p },
      { kind: 'reminder', reminder: r },
    ]);
  });

  it('is just the Reminders with no Pause, and just the Pauses with no Reminder', () => {
    const r = reminder('r', 10 * MIN);
    const p: Pause = { from: 20 * MIN, until: 30 * MIN };
    expect(todayLines([r], [])).toEqual([{ kind: 'reminder', reminder: r }]);
    expect(todayLines([], [p])).toEqual([{ kind: 'pause', pause: p }]);
  });
});

describe('a Pause for the rest of today', () => {
  it('ends at local midnight in the Settings time zone', () => {
    // 00:00 on Wednesday 2026-11-11 in Madrid is 23:00 UTC on Tuesday.
    expect(endsAtMidnight(Date.UTC(2026, 10, 10, 23, 0), 'Europe/Madrid')).toBe(true);
  });

  it('does not end at midnight at any other time, UTC midnight included', () => {
    expect(endsAtMidnight(Date.UTC(2026, 10, 11, 0, 0), 'Europe/Madrid')).toBe(false);
    expect(endsAtMidnight(Date.UTC(2026, 10, 10, 23, 1), 'Europe/Madrid')).toBe(false);
  });
});

describe('why a Reminder was dropped', () => {
  const dropped: Reminder = { id: 'r', firesAt: 10 * MIN, suggestion: [], status: 'dropped' };

  it('is the reason stored on it', () => {
    expect(dropReason({ ...dropped, droppedBy: 'pause' })).toBe('pause');
    expect(dropReason({ ...dropped, droppedBy: 'dayOff' })).toBe('dayOff');
    expect(dropReason({ ...dropped, droppedBy: 'closing' })).toBe('closing');
  });

  it('is closing when none is stored (dropped before the reason was stored)', () => {
    expect(dropReason(dropped)).toBe('closing');
  });
});
