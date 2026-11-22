import { describe, expect, it } from 'vitest';
import { endsAtMidnight } from './index';

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
