import { describe, expect, it } from 'vitest';
import { formatDose } from './index';

describe('formatDose', () => {
  it('reads reps', () => {
    expect(formatDose({ kind: 'reps', amount: 10, eachSide: false })).toBe('10 reps');
  });

  it('reads seconds', () => {
    expect(formatDose({ kind: 'seconds', amount: 20, eachSide: false })).toBe('20 s');
  });

  it('reads seconds each side', () => {
    expect(formatDose({ kind: 'seconds', amount: 20, eachSide: true })).toBe('20 s each side');
  });

  it('reads reps each side', () => {
    expect(formatDose({ kind: 'reps', amount: 10, eachSide: true })).toBe('10 reps each side');
  });
});
