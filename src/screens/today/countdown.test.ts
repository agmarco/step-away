import { describe, expect, it } from 'vitest';
import { countdownOf } from './countdown';

const MIN = 60_000;
const NOW = Date.parse('2026-11-26T11:24:00Z');

describe('countdownOf: how long until a time, for the hero\'s "Next Reminder at HH:MM · in …"', () => {
  it('counts whole minutes, rounding up, so a Reminder never shows as sooner than it is', () => {
    expect(countdownOf(NOW + 43 * MIN, NOW)).toBe('in 43 min');
    expect(countdownOf(NOW + 42 * MIN + 1_000, NOW)).toBe('in 43 min');
  });

  it('says "in 1 min" for anything up to a minute away', () => {
    expect(countdownOf(NOW + 1_000, NOW)).toBe('in 1 min');
    expect(countdownOf(NOW + MIN, NOW)).toBe('in 1 min');
  });

  it('uses hours from 60 minutes on, dropping a zero minute part', () => {
    expect(countdownOf(NOW + 60 * MIN, NOW)).toBe('in 1 h');
    expect(countdownOf(NOW + 65 * MIN, NOW)).toBe('in 1 h 5 min');
    expect(countdownOf(NOW + 135 * MIN, NOW)).toBe('in 2 h 15 min');
  });

  it('says "now" once the time has come', () => {
    expect(countdownOf(NOW, NOW)).toBe('now');
    expect(countdownOf(NOW - 5 * MIN, NOW)).toBe('now');
  });
});
