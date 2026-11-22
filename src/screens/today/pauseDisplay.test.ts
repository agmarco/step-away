import { describe, expect, it } from 'vitest';
import type { Pause, Reminder } from '../../core';
import { todayLines } from './pauseDisplay';

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
