import { describe, expect, it } from 'vitest';
import { dropReason, type Reminder } from './index';

const MIN = 60_000;

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
