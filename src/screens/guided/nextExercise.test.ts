import { describe, expect, it } from 'vitest';
import { showsNext } from './nextExercise';

describe('showsNext: Next exercise → only on a card with another card after it', () => {
  it('is hidden on a one-Exercise Reminder', () => {
    expect(showsNext(0, 1)).toBe(false);
  });

  it('shows on the first of 2 cards and is hidden on the last', () => {
    expect(showsNext(0, 2)).toBe(true);
    expect(showsNext(1, 2)).toBe(false);
  });

  it('shows on the first and second of 3 cards and is hidden on the last', () => {
    expect(showsNext(0, 3)).toBe(true);
    expect(showsNext(1, 3)).toBe(true);
    expect(showsNext(2, 3)).toBe(false);
  });
});
