import { describe, expect, it } from 'vitest';
import { endsAtMidnight, isRunning, type Pause } from './index';

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

describe('a running Pause', () => {
  const MIN = 60_000;
  const pause: Pause = { from: 10 * MIN, until: 70 * MIN };

  it('runs from its start up to, not including, its end', () => {
    expect(isRunning(pause, 10 * MIN)).toBe(true);
    expect(isRunning(pause, 40 * MIN)).toBe(true);
    expect(isRunning(pause, 70 * MIN - 1)).toBe(true);
  });

  it('is not running before it starts or once it has ended', () => {
    expect(isRunning(pause, 10 * MIN - 1)).toBe(false);
    expect(isRunning(pause, 70 * MIN)).toBe(false);
    expect(isRunning(pause, 100 * MIN)).toBe(false);
  });
});
